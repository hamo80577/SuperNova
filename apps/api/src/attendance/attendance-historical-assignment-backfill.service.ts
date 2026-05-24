import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AssignmentStatus,
  AttendanceImportMode,
  AttendanceMatchedRole,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AttendanceLocationMapperService } from "./attendance-location-mapper.service";
import { AttendanceMatcherService } from "./attendance-matcher.service";
import { AttendanceParserService } from "./attendance-parser.service";
import type {
  ConfirmHistoricalAssignmentBackfillInput,
  ConfirmHistoricalAssignmentBackfillResult,
  HistoricalAssignmentBackfillNotice,
  HistoricalAssignmentBackfillPreview,
  HistoricalAssignmentBackfillProposal,
  ParsedAttendanceRow,
  PreviewHistoricalAssignmentBackfillInput
} from "./attendance.types";

type MappedVendor = {
  id: string;
  vendorExternalId: string | null;
  vendorName: string | null;
  chainId: string;
};

type BackfillCandidate = {
  row: ParsedAttendanceRow;
  identifier: string;
  pickerId: string;
  vendorExternalId: string;
};

type BackfillEvidence = BackfillCandidate & {
  vendor: MappedVendor;
};

type ExistingPickerAssignment = {
  id: string;
  pickerId: string;
  vendorId: string;
  startDate: Date;
  endDate: Date | null;
};

@Injectable()
export class AttendanceHistoricalAssignmentBackfillService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttendanceParserService)
    private readonly parser: AttendanceParserService,
    @Inject(AttendanceMatcherService)
    private readonly matcher: AttendanceMatcherService,
    @Inject(AttendanceLocationMapperService)
    private readonly locationMapper: AttendanceLocationMapperService
  ) {}

  async previewHistoricalAssignmentBackfill(
    input: PreviewHistoricalAssignmentBackfillInput
  ): Promise<HistoricalAssignmentBackfillPreview> {
    this.assertHistoricalBackfillMode(input.mode);
    this.assertPeriod(input.periodFrom, input.periodTo);
    void input.createdById;
    void input.referenceDate;

    const rows = await this.resolveRows(input);
    const eligibleRows = rows
      .filter((row) => isEgypt(row.division))
      .filter(
        (row) =>
          row.attendanceDate &&
          row.attendanceDate >= input.periodFrom &&
          row.attendanceDate <= input.periodTo
      )
      .map((row) => ({ ...row, identifier: normalizeIdentifier(row.identifier) }));

    const matchResults = await this.matcher.matchIdentifiers(
      eligibleRows.map((row) => row.identifier)
    );
    const warnings: HistoricalAssignmentBackfillNotice[] = [];
    const conflicts: HistoricalAssignmentBackfillNotice[] = [];
    const candidates: BackfillCandidate[] = [];
    let matchedPickers = 0;
    let ignoredChampRows = 0;

    for (const row of eligibleRows) {
      if (!row.attendanceDate) continue;
      const identifier = normalizeIdentifier(row.identifier);
      const match = matchResults.get(identifier);

      if (!match || match.outcome === "UNMATCHED_IDENTIFIER") {
        warnings.push(
          notice(row, "UNMATCHED_IDENTIFIER", `No Picker matched identifier ${identifier}.`)
        );
        continue;
      }

      if (match.outcome === "MATCHED_CHAMP") {
        ignoredChampRows += 1;
        continue;
      }

      if (match.outcome === "AMBIGUOUS_IDENTIFIER_MATCH") {
        conflicts.push(
          notice(
            row,
            "AMBIGUOUS_IDENTIFIER_MATCH",
            `Identifier ${identifier} matched more than one supported user.`
          )
        );
        continue;
      }

      if (
        match.outcome !== "MATCHED_PICKER" ||
        !match.user ||
        match.matchedRole !== AttendanceMatchedRole.PICKER
      ) {
        warnings.push(
          notice(
            row,
            "UNSUPPORTED_ROLE",
            `Identifier ${identifier} is not a Picker assignment backfill candidate.`
          )
        );
        continue;
      }

      matchedPickers += 1;
      const parsedLocation = this.locationMapper.parseLocation(row.rawLocation);

      if (!parsedLocation.vendorExternalId) {
        warnings.push(
          notice(
            row,
            "UNMAPPED_LOCATION_CODE",
            "Attendance Location does not contain a mapped vendor code."
          )
        );
        continue;
      }

      candidates.push({
        row,
        identifier,
        pickerId: match.user.id,
        vendorExternalId: parsedLocation.vendorExternalId
      });
    }

    const sameDateConflictKeys = this.collectSameDateLocationConflicts(
      candidates,
      conflicts
    );
    const nonConflictingCandidates = candidates.filter(
      (candidate) => !sameDateConflictKeys.has(candidateDateKey(candidate))
    );
    const vendorsByExternalId = await this.loadVendorsByExternalId(
      nonConflictingCandidates.map((candidate) => candidate.vendorExternalId)
    );
    const mappedEvidence: BackfillEvidence[] = [];

    for (const candidate of nonConflictingCandidates) {
      const vendor = vendorsByExternalId.get(candidate.vendorExternalId);

      if (!vendor) {
        warnings.push(
          notice(
            candidate.row,
            "UNMAPPED_LOCATION_CODE",
            `No SuperNova Vendor matched Location code ${candidate.vendorExternalId}.`
          )
        );
        continue;
      }

      mappedEvidence.push({ ...candidate, vendor });
    }

    const proposalEvidence = await this.excludeCoveredOrConflictingEvidence({
      evidence: mappedEvidence,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      conflicts
    });
    const proposals = this.buildProposals(proposalEvidence);

    return {
      totalRowsAnalyzed: eligibleRows.length,
      matchedPickers,
      ignoredChampRows,
      unmappedLocationCount: warnings.filter(
        (warning) => warning.reason === "UNMAPPED_LOCATION_CODE"
      ).length,
      conflictCount: conflicts.length,
      proposalsCount: proposals.length,
      proposals,
      warnings,
      conflicts
    };
  }

  async confirmHistoricalAssignmentBackfill(
    input: ConfirmHistoricalAssignmentBackfillInput
  ): Promise<ConfirmHistoricalAssignmentBackfillResult> {
    void input.confirmedById;
    void input.importBatchId;
    const referenceDate = startOfUtcDay(input.referenceDate ?? new Date());
    const conflicts: HistoricalAssignmentBackfillNotice[] = [];

    for (const proposal of input.proposals) {
      const validationMessage = validateProposal(proposal, referenceDate);

      if (validationMessage) {
        conflicts.push({
          identifier: proposal.identifier,
          attendanceDate: proposal.proposedStartDate ?? null,
          reason: "INVALID_PROPOSAL",
          message: validationMessage
        });
        continue;
      }

      const entityValidationMessage = await this.validateProposalEntities(proposal);

      if (entityValidationMessage) {
        conflicts.push({
          identifier: proposal.identifier,
          attendanceDate: proposal.proposedStartDate,
          reason: "INVALID_PROPOSAL",
          message: entityValidationMessage
        });
        continue;
      }

      const overlappingAssignment =
        await this.prisma.pickerBranchAssignment.findFirst({
          where: {
            pickerId: proposal.pickerId,
            startDate: { lte: proposal.proposedEndDate },
            OR: [
              { endDate: null },
              { endDate: { gte: proposal.proposedStartDate } }
            ]
          },
          orderBy: { startDate: "desc" }
        });

      if (overlappingAssignment) {
        conflicts.push({
          identifier: proposal.identifier,
          attendanceDate: proposal.proposedStartDate,
          reason: "OVERLAPPING_ASSIGNMENT",
          message:
            "A PickerBranchAssignment already overlaps the proposed historical range."
        });
        continue;
      }
    }

    if (conflicts.length) {
      return {
        createdCount: 0,
        skippedCount: conflicts.length,
        conflictCount: conflicts.length,
        createdAssignmentIds: [],
        conflicts
      };
    }

    const createdAssignments = await this.prisma.$transaction(
      input.proposals.map((proposal) =>
        this.prisma.pickerBranchAssignment.create({
          data: {
            pickerId: proposal.pickerId,
            vendorId: proposal.vendorId,
            status: AssignmentStatus.CLOSED,
            startDate: proposal.proposedStartDate,
            endDate: proposal.proposedEndDate
          }
        })
      )
    );

    return {
      createdCount: createdAssignments.length,
      skippedCount: 0,
      conflictCount: 0,
      createdAssignmentIds: createdAssignments.map((assignment) => assignment.id),
      conflicts
    };
  }

  private async validateProposalEntities(
    proposal: HistoricalAssignmentBackfillProposal
  ) {
    const picker = await this.prisma.user.findUnique({
      where: { id: proposal.pickerId },
      select: { role: true }
    });

    if (!picker || picker.role !== UserRole.PICKER) {
      return "Historical assignment proposal must target an existing Picker.";
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: proposal.vendorId },
      select: { id: true }
    });

    if (!vendor) {
      return "Historical assignment proposal must target an existing Vendor.";
    }

    return null;
  }

  private async resolveRows(input: PreviewHistoricalAssignmentBackfillInput) {
    if (input.rows) {
      return input.rows;
    }

    if (input.buffer) {
      const parsed = await this.parser.parseAttendanceBuffer(input.buffer);
      return parsed.rows;
    }

    throw new BadRequestException(
      "Historical assignment backfill preview requires parsed rows or a file buffer."
    );
  }

  private collectSameDateLocationConflicts(
    candidates: BackfillCandidate[],
    conflicts: HistoricalAssignmentBackfillNotice[]
  ) {
    const grouped = new Map<string, BackfillCandidate[]>();

    candidates.forEach((candidate) => {
      const key = pickerDateKey(candidate);
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    });

    const conflictKeys = new Set<string>();
    grouped.forEach((items) => {
      const locationCodes = new Set(items.map((item) => item.vendorExternalId));

      if (locationCodes.size <= 1) {
        return;
      }

      conflictKeys.add(pickerDateKey(items[0]));
      conflicts.push(
        notice(
          items[0].row,
          "MULTIPLE_LOCATIONS_SAME_DATE",
          "Picker has multiple different Attendance Location codes on the same date."
        )
      );
    });

    return conflictKeys;
  }

  private async loadVendorsByExternalId(externalIds: string[]) {
    const uniqueExternalIds = Array.from(new Set(externalIds.filter(Boolean)));
    const vendorsByExternalId = new Map<string, MappedVendor>();

    if (!uniqueExternalIds.length) {
      return vendorsByExternalId;
    }

    const vendors = await this.prisma.vendor.findMany({
      where: {
        vendorExternalId: { in: uniqueExternalIds }
      },
      select: {
        id: true,
        vendorExternalId: true,
        vendorName: true,
        chainId: true
      }
    });

    vendors.forEach((vendor) => {
      if (vendor.vendorExternalId) {
        vendorsByExternalId.set(vendor.vendorExternalId, vendor);
      }
    });

    return vendorsByExternalId;
  }

  private async excludeCoveredOrConflictingEvidence(input: {
    evidence: BackfillEvidence[];
    periodFrom: Date;
    periodTo: Date;
    conflicts: HistoricalAssignmentBackfillNotice[];
  }) {
    const pickerIds = Array.from(
      new Set(input.evidence.map((evidence) => evidence.pickerId))
    );

    if (!pickerIds.length) {
      return [];
    }

    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: {
        pickerId: { in: pickerIds },
        startDate: { lte: input.periodTo },
        OR: [{ endDate: null }, { endDate: { gte: input.periodFrom } }]
      },
      select: {
        id: true,
        pickerId: true,
        vendorId: true,
        startDate: true,
        endDate: true
      }
    });

    return input.evidence.filter((evidence) => {
      const date = evidence.row.attendanceDate;
      if (!date) return false;

      const coveringAssignments = assignments.filter((assignment) =>
        coversDate(assignment, evidence.pickerId, date)
      );

      if (coveringAssignments.some((assignment) => assignment.vendorId === evidence.vendor.id)) {
        return false;
      }

      if (coveringAssignments.length) {
        input.conflicts.push(
          notice(
            evidence.row,
            "EXISTING_ASSIGNMENT_DIFFERENT_VENDOR",
            "Existing PickerBranchAssignment covers this date with a different Vendor."
          )
        );
        return false;
      }

      return true;
    });
  }

  private buildProposals(evidence: BackfillEvidence[]) {
    const evidenceByPicker = new Map<string, BackfillEvidence[]>();

    evidence.forEach((item) => {
      evidenceByPicker.set(item.pickerId, [...(evidenceByPicker.get(item.pickerId) ?? []), item]);
    });

    const proposals: HistoricalAssignmentBackfillProposal[] = [];

    evidenceByPicker.forEach((pickerEvidence) => {
      const sortedEvidence = [...pickerEvidence].sort(
        (a, b) =>
          a.row.attendanceDate!.getTime() - b.row.attendanceDate!.getTime() ||
          a.row.rowNumber - b.row.rowNumber
      );
      let segment: BackfillEvidence[] = [];

      for (const item of sortedEvidence) {
        if (!segment.length || segment[0].vendor.id === item.vendor.id) {
          segment.push(item);
          continue;
        }

        proposals.push(toProposal(segment));
        segment = [item];
      }

      if (segment.length) {
        proposals.push(toProposal(segment));
      }
    });

    return proposals;
  }

  private assertHistoricalBackfillMode(mode: AttendanceImportMode) {
    if (mode !== AttendanceImportMode.HISTORICAL_BACKFILL) {
      throw new BadRequestException(
        "Historical assignment backfill preview requires Historical Backfill mode."
      );
    }
  }

  private assertPeriod(periodFrom: Date, periodTo: Date) {
    if (
      Number.isNaN(periodFrom.getTime()) ||
      Number.isNaN(periodTo.getTime()) ||
      periodFrom > periodTo
    ) {
      throw new BadRequestException("A valid historical backfill period is required.");
    }
  }
}

function toProposal(segment: BackfillEvidence[]): HistoricalAssignmentBackfillProposal {
  const first = segment[0];
  const last = segment[segment.length - 1];

  return {
    pickerId: first.pickerId,
    identifier: first.identifier,
    vendorId: first.vendor.id,
    vendorExternalId: first.vendor.vendorExternalId!,
    vendorName: first.vendor.vendorName,
    chainId: first.vendor.chainId,
    proposedStartDate: first.row.attendanceDate!,
    proposedEndDate: last.row.attendanceDate!,
    source: "ATTENDANCE_BACKFILL",
    evidenceCount: segment.length
  };
}

function validateProposal(
  proposal: HistoricalAssignmentBackfillProposal,
  referenceDate: Date
) {
  if (proposal.source !== "ATTENDANCE_BACKFILL") {
    return "Historical assignment proposal source is invalid.";
  }

  if (
    !(proposal.proposedStartDate instanceof Date) ||
    Number.isNaN(proposal.proposedStartDate.getTime()) ||
    !(proposal.proposedEndDate instanceof Date) ||
    Number.isNaN(proposal.proposedEndDate.getTime())
  ) {
    return "Historical assignment proposal must have valid start and end dates.";
  }

  if (proposal.proposedStartDate > proposal.proposedEndDate) {
    return "Historical assignment proposal start date is after end date.";
  }

  if (startOfUtcDay(proposal.proposedEndDate) > referenceDate) {
    return "Historical assignment proposal end date must not be in the future.";
  }

  return null;
}

function notice(
  row: ParsedAttendanceRow,
  reason: HistoricalAssignmentBackfillNotice["reason"],
  message: string
): HistoricalAssignmentBackfillNotice {
  return {
    rowNumber: row.rowNumber,
    attendanceDate: row.attendanceDate,
    identifier: normalizeIdentifier(row.identifier),
    location: row.rawLocation,
    reason,
    message
  };
}

function coversDate(
  assignment: ExistingPickerAssignment,
  pickerId: string,
  date: Date
) {
  return (
    assignment.pickerId === pickerId &&
    assignment.startDate <= date &&
    (assignment.endDate === null || assignment.endDate >= date)
  );
}

function pickerDateKey(candidate: BackfillCandidate) {
  return `${candidate.pickerId}:${candidate.row.attendanceDate?.toISOString() ?? ""}`;
}

function candidateDateKey(candidate: BackfillCandidate) {
  return pickerDateKey(candidate);
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

function isEgypt(division: string) {
  return division.trim().toLowerCase() === "egypt";
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}
