import { createHash } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  AssignmentStatus,
  AttendanceAssignmentMismatchStatus,
  AttendanceImportBatchStatus,
  AttendanceImportMode,
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  AttendanceLocationMappingStatus,
  AttendanceMatchStatus,
  AttendancePersonRole,
  Prisma,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { createManyInChunks } from "../common/database/create-many-in-chunks";
import { IMPORT_ATTENDANCE_SUCCESS_EVENT } from "../dashboard-cache/dashboard-cache.constants";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import type {
  AttendanceCalculationInputRow,
  AttendanceCalculationIssue
} from "./attendance-calculation.types";
import {
  AttendanceImportConfirmOptions,
  AttendanceImportConfirmResult,
  AttendanceImportPreviewOptions,
  AttendanceImportPreviewResult
} from "./attendance-import.types";
import { AttendanceParserService } from "./attendance-parser.service";
import type {
  AttendanceMatchedUser,
  AttendanceParsedRow,
  AttendancePreviewIssue,
  AttendanceReportedLocationSummary
} from "./attendance-preview.types";
import { parseAttendanceLocation } from "./attendance-location-parser";
import { AttendanceUserLookupService } from "./attendance-user-lookup.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

type AttendancePersistedIssue =
  | AttendancePreviewIssue
  | AttendanceCalculationIssue;

type AttendancePrismaTransaction = Prisma.TransactionClient;

type AttendanceLocationVendor = {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId: string | null;
  chainId: string;
  chain: {
    id: string;
    chainName: string;
  };
};

type AttendanceLocationVendorMatch = {
  vendor: AttendanceLocationVendor;
  mappingStatus: AttendanceLocationMappingStatus;
};

type AttendanceRowLocationContext = {
  reportedVendorId: string | null;
  reportedChainId: string | null;
  reportedLocationCode: string | null;
  reportedLocationName: string | null;
  reportedLocationRaw: string | null;
  shiftLocationCode: string | null;
  shiftLocationName: string | null;
  shiftLocationRaw: string | null;
  locationMappingStatus: AttendanceLocationMappingStatus;
  assignmentMismatchStatus: AttendanceAssignmentMismatchStatus;
  vendorName: string | null;
  chainName: string | null;
};

type AttendanceLocationPreviewEnrichment = {
  issues: AttendancePreviewIssue[];
  contextsByRawRowNumber: Map<number, AttendanceRowLocationContext>;
  mappedLocationRows: number;
  unmappedLocationRows: number;
  missingLocationCodeRows: number;
  activeAssignmentMismatchRows: number;
  locationShiftLocationDifferenceRows: number;
  rowsByReportedLocationCode: AttendanceReportedLocationSummary[];
};

const ATTENDANCE_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS = 60_000;

@Injectable()
export class AttendanceImportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AttendanceParserService)
    private readonly parser: AttendanceParserService,
    @Inject(AttendanceValidatorService)
    private readonly validator: AttendanceValidatorService,
    @Inject(AttendanceCalculationService)
    private readonly calculator: AttendanceCalculationService,
    @Inject(AttendanceUserLookupService)
    private readonly userLookup: AttendanceUserLookupService,
    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2
  ) {}

  async previewImport(
    buffer: Buffer,
    options: AttendanceImportPreviewOptions
  ): Promise<AttendanceImportPreviewResult> {
    return this.processImport(buffer, options);
  }

  async processQueuedImport(
    batchId: string,
    buffer: Buffer,
    options: AttendanceImportPreviewOptions
  ): Promise<AttendanceImportPreviewResult> {
    return this.processImport(buffer, options, batchId);
  }

  private async processImport(
    buffer: Buffer,
    options: AttendanceImportPreviewOptions,
    queuedBatchId?: string
  ): Promise<AttendanceImportPreviewResult> {
    assertAttendanceImportActor(options.actor);

    if (buffer.length === 0) {
      throw new BadRequestException("Attendance file is required.");
    }

    if (isMtdImportModeInput(options.importMode) && options.periodMonth?.trim()) {
      throw new BadRequestException(
        "periodMonth is only accepted for HISTORICAL_MONTH attendance imports."
      );
    }

    const now = normalizeDateTime(options.now);
    const uploadDate = options.uploadDate ?? now;
    const workbook = await this.parser.parseWorkbook(buffer);
    const preview = await this.validator.validateParsedWorkbook(workbook, {
      duplicateResolutionRowNumbers: options.duplicateResolutionRowNumbers,
      importMode: options.importMode,
      periodMonth: options.periodMonth,
      uploadDate,
      rowsPreviewLimit: options.rowsPreviewLimit,
      userLookup: this.userLookup
    });

    const matchedUsers = await this.loadMatchLookup(workbook.rows);
    const duplicateSelections = selectedDuplicateRowsByMatchedKey(
      workbook.rows,
      matchedUsers,
      new Set(options.duplicateResolutionRowNumbers ?? [])
    );
    const locationEnrichment = await this.buildLocationPreviewEnrichment(
      workbook.rows,
      matchedUsers,
      duplicateSelections,
      preview.importMode
    );
    const hasLocationMappingErrors = locationEnrichment.issues.some(
      (issue) => issue.severity === AttendanceIssueSeverity.ERROR
    );
    const validationIssueCounts = countIssuesByRow([
      ...preview.issues,
      ...locationEnrichment.issues
    ]);
    const calculationRows =
      preview.canConfirm && preview.periodMonth && !hasLocationMappingErrors
        ? buildCalculationRows(
            preview.periodMonth,
            workbook.rows,
            matchedUsers,
            validationIssueCounts,
            duplicateSelections,
            locationEnrichment.contextsByRawRowNumber
          )
        : [];
    const calculationResult =
      preview.canConfirm && preview.periodMonth && !hasLocationMappingErrors
        ? this.calculator.calculate({
            periodMonth: preview.periodMonth,
            calculatedAt: now,
            rows: calculationRows
          })
        : {
            dailyRecords: [],
            monthlySummaries: [],
            issues: []
          };
    const combinedIssues: AttendancePersistedIssue[] = [
      ...preview.issues,
      ...locationEnrichment.issues,
      ...calculationResult.issues
    ];
    const hasCalculationErrors = calculationResult.issues.some(
      (issue) => issue.severity === AttendanceIssueSeverity.ERROR
    );
    const errorRows = countIssueRows(combinedIssues, AttendanceIssueSeverity.ERROR);
    const warningRows = countIssueRows(combinedIssues, AttendanceIssueSeverity.WARNING);
    const status =
      preview.canConfirm &&
      preview.periodMonth &&
      !hasLocationMappingErrors &&
      !hasCalculationErrors
        ? AttendanceImportBatchStatus.VALIDATED
        : AttendanceImportBatchStatus.FAILED;
    const buildPreviewResult = (
      batchId: string
    ): AttendanceImportPreviewResult => ({
      batchId,
      status,
      canConfirm: status === AttendanceImportBatchStatus.VALIDATED,
      preview: {
        ...preview,
        canConfirm: status === AttendanceImportBatchStatus.VALIDATED,
        errorRows,
        warningRows,
        mappedLocationRows: locationEnrichment.mappedLocationRows,
        unmappedLocationRows: locationEnrichment.unmappedLocationRows,
        missingLocationCodeRows: locationEnrichment.missingLocationCodeRows,
        activeAssignmentMismatchRows:
          locationEnrichment.activeAssignmentMismatchRows,
        locationShiftLocationDifferenceRows:
          locationEnrichment.locationShiftLocationDifferenceRows,
        rowsByReportedLocationCode:
          locationEnrichment.rowsByReportedLocationCode,
        issues: combinedIssues
      },
      dailyRecordCount: calculationResult.dailyRecords.length,
      monthlySummaryCount: calculationResult.monthlySummaries.length,
      issueCount: combinedIssues.length
    });
    const queuedPreviewResult = queuedBatchId
      ? buildPreviewResult(queuedBatchId)
      : null;

    const batch = await this.prisma.$transaction(
      async (tx) => {
        if (queuedBatchId) {
          await tx.attendanceImportIssue.deleteMany({
            where: { batchId: queuedBatchId }
          });
          await tx.attendanceDailyRecord.deleteMany({
            where: { importBatchId: queuedBatchId }
          });
          await tx.attendancePickerMonthlySummary.deleteMany({
            where: { sourceBatchId: queuedBatchId }
          });
        }

        const batchData = {
          periodMonth: preview.periodMonth ?? periodMonthFromUploadDate(uploadDate),
          fileName: normalizeFileName(options.fileName),
          fileHash: hashBuffer(buffer),
          importMode: preview.importMode,
          uploadedByUserId: options.actor.id,
          status,
          rowCount: preview.rowCount,
          egyptRows: preview.egyptRows,
          matchedPickerRows: preview.matchedPickerRows,
          matchedChampRows: preview.matchedChampRows,
          ambiguousIdentifierRows: preview.ambiguousIdentifierRows,
          unmatchedRows: preview.unmatchedRows,
          excludedNonPickerRows: preview.excludedNonPickerRows,
          excludedNonEgyptRows: preview.nonEgyptRows,
          errorRows,
          warningRows,
          failureReason: null,
          ...(queuedPreviewResult
            ? { previewResult: toPrismaJson(queuedPreviewResult) }
            : {}),
          coverageStartDate: dateOnlyToUtcDateOrNull(preview.coverageStartDate),
          coverageEndDate: dateOnlyToUtcDateOrNull(preview.coverageEndDate),
          expectedCoverageEndDate: dateOnlyToUtcDateOrNull(
            preview.expectedCoverageEndDate
          ),
          replaceOfBatchId: null,
          confirmedByUserId: null,
          confirmedAt: null
        };
        const createdBatch = queuedBatchId
          ? await tx.attendanceImportBatch.update({
              where: { id: queuedBatchId },
              data: batchData
            })
          : await tx.attendanceImportBatch.create({
              data: { ...batchData, uploadedAt: now }
            });

        if (combinedIssues.length > 0) {
          const issueRows = combinedIssues.map((issue) => ({
            batchId: createdBatch.id,
            rowNumber: issue.rowNumber,
            shopperId: issue.shopperId,
            severity: issue.severity,
            issueCode: issue.issueCode,
            fieldName: issue.fieldName,
            message: issue.message,
            resolutionStatus: issue.resolutionStatus
          }));
          await createManyInChunks(issueRows, (chunk) =>
            tx.attendanceImportIssue.createMany({ data: chunk })
          );
        }

        if (status === AttendanceImportBatchStatus.VALIDATED) {
          if (calculationResult.dailyRecords.length > 0) {
            const dailyRecordRows = calculationResult.dailyRecords.map(
              (record) =>
                mapDailyRecordForCreate(createdBatch.id, record)
            );
            await createManyInChunks(dailyRecordRows, (chunk) =>
              tx.attendanceDailyRecord.createMany({ data: chunk })
            );
          }

          if (calculationResult.monthlySummaries.length > 0) {
            const monthlySummaryRows = calculationResult.monthlySummaries.map(
              (summary) =>
                mapMonthlySummaryForCreate(createdBatch.id, summary)
            );
            await createManyInChunks(monthlySummaryRows, (chunk) =>
              tx.attendancePickerMonthlySummary.createMany({ data: chunk })
            );
          }
        }

        await tx.auditLog.create({
          data: {
            actorUserId: options.actor.id,
            action:
              status === AttendanceImportBatchStatus.VALIDATED
                ? "ATTENDANCE_IMPORT_PREVIEW_CREATED"
                : "ATTENDANCE_IMPORT_FAILED_VALIDATION",
            entityType: "AttendanceImportBatch",
            entityId: createdBatch.id,
            oldValue: Prisma.JsonNull,
            newValue: toAuditJson({
              periodMonth: createdBatch.periodMonth,
              importMode: createdBatch.importMode,
              batchId: createdBatch.id,
              coverageStartDate: preview.coverageStartDate,
              coverageEndDate: preview.coverageEndDate,
              expectedCoverageEndDate: preview.expectedCoverageEndDate,
              rowCount: preview.rowCount,
              matchedPickerRows: preview.matchedPickerRows,
              matchedChampRows: preview.matchedChampRows,
              ambiguousIdentifierRows: preview.ambiguousIdentifierRows,
              errorRows,
              warningRows,
              status
            }),
            ipAddress: options.ipAddress ?? null,
            userAgent: options.userAgent ?? null
          }
        });

        return createdBatch;
      },
      { timeout: ATTENDANCE_IMPORT_PREVIEW_TRANSACTION_TIMEOUT_MS }
    );

    return queuedPreviewResult ?? buildPreviewResult(batch.id);
  }

  async getPreview(batchId: string): Promise<AttendanceImportPreviewResult> {
    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        previewResult: true,
        failureReason: true
      }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import batch was not found.");
    }

    if (
      batch.status === AttendanceImportBatchStatus.PENDING ||
      batch.status === AttendanceImportBatchStatus.PROCESSING
    ) {
      throw new ConflictException("Attendance import is still processing.");
    }

    if (!batch.previewResult) {
      throw new ConflictException(
        batch.failureReason ?? "Attendance import preview is unavailable."
      );
    }

    return batch.previewResult as unknown as AttendanceImportPreviewResult;
  }

  async confirmImport(
    batchId: string,
    options: AttendanceImportConfirmOptions
  ): Promise<AttendanceImportConfirmResult> {
    assertAttendanceImportActor(options.actor);

    const batch = await this.prisma.attendanceImportBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new NotFoundException("Attendance import batch was not found.");
    }

    assertConfirmableBatch(batch);

    const confirmedAt = normalizeDateTime(options.now);

    const confirmation = await this.prisma.$transaction(async (tx) => {
      const previousActive = await tx.attendanceImportBatch.findFirst({
        where: {
          periodMonth: batch.periodMonth,
          status: AttendanceImportBatchStatus.ACTIVE,
          id: {
            not: batch.id
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (previousActive) {
        await tx.attendanceImportBatch.update({
          where: { id: previousActive.id },
          data: {
            status: AttendanceImportBatchStatus.REPLACED
          }
        });
      }

      const activatedBatch = await tx.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          status: AttendanceImportBatchStatus.ACTIVE,
          replaceOfBatchId: previousActive?.id ?? null,
          confirmedByUserId: options.actor.id,
          confirmedAt
        }
      });

      await writeConfirmAuditLogs(tx, {
        actorUserId: options.actor.id,
        batchId: activatedBatch.id,
        importMode: activatedBatch.importMode,
        periodMonth: activatedBatch.periodMonth,
        coverageStartDate: formatDateOnlyOrNull(activatedBatch.coverageStartDate),
        coverageEndDate: formatDateOnlyOrNull(activatedBatch.coverageEndDate),
        expectedCoverageEndDate: formatDateOnlyOrNull(
          activatedBatch.expectedCoverageEndDate
        ),
        rowCount: activatedBatch.rowCount,
        errorRows: activatedBatch.errorRows,
        warningRows: activatedBatch.warningRows,
        previousActiveBatchId: previousActive?.id ?? null,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null
      });

      return {
        batchId: activatedBatch.id,
        periodMonth: activatedBatch.periodMonth,
        status: activatedBatch.status,
        previousActiveBatchId: previousActive?.id ?? null,
        confirmedAt: activatedBatch.confirmedAt?.toISOString() ?? confirmedAt.toISOString()
      };
    });

    this.eventEmitter.emit(IMPORT_ATTENDANCE_SUCCESS_EVENT, {
      eventId: confirmation.batchId,
      months: [confirmation.periodMonth],
      source: "ATTENDANCE_IMPORT"
    });

    return confirmation;
  }

  private async buildLocationPreviewEnrichment(
    parsedRows: AttendanceParsedRow[],
    matchedUsers: Map<string, AttendanceMatchedUser>,
    duplicateSelections: Map<string, number>,
    importMode: AttendanceImportMode
  ): Promise<AttendanceLocationPreviewEnrichment> {
    const mappableRows = buildMappableRows(
      parsedRows,
      matchedUsers,
      duplicateSelections
    );
    const reportedLocationCodes = uniqueStrings(
      mappableRows
        .map(({ row }) => parseAttendanceLocation(row.sourceLocation).code)
        .filter((code): code is string => Boolean(code))
    );
    const vendorMatches =
      await this.loadVendorMatchesByLocationCode(reportedLocationCodes);
    const shouldCompareActiveAssignments = importMode === AttendanceImportMode.MTD;
    const pickerUserIds = uniqueStrings(
      mappableRows
        .filter(({ user }) => user.personRole === AttendancePersonRole.PICKER)
        .map(({ user }) => user.id)
    );
    const champUserIds = uniqueStrings(
      mappableRows
        .filter(({ user }) => user.personRole === AttendancePersonRole.CHAMP)
        .map(({ user }) => user.id)
    );
    const activeAssignments = shouldCompareActiveAssignments
      ? await this.loadActiveAssignmentsByPickerId(pickerUserIds)
      : new Map<string, string>();
    const champActiveVendorIds = shouldCompareActiveAssignments
      ? await this.loadActiveChampVendorIds(champUserIds)
      : new Map<string, Set<string>>();

    const issues: AttendancePreviewIssue[] = [];
    const contextsByRawRowNumber = new Map<
      number,
      AttendanceRowLocationContext
    >();
    let mappedLocationRows = 0;
    let unmappedLocationRows = 0;
    let missingLocationCodeRows = 0;
    let activeAssignmentMismatchRows = 0;
    let locationShiftLocationDifferenceRows = 0;

    for (const { row, user } of mappableRows) {
      const reported = parseAttendanceLocation(row.sourceLocation);
      const shift = parseAttendanceLocation(row.shiftLocation);
      const context = defaultLocationContext(row);

      if (!reported.code) {
        context.locationMappingStatus =
          AttendanceLocationMappingStatus.MISSING_CODE;
        missingLocationCodeRows += 1;
        issues.push(
          locationIssue({
            row,
            severity: AttendanceIssueSeverity.ERROR,
            issueCode: AttendanceIssueCode.MISSING_ATTENDANCE_LOCATION_CODE,
            fieldName: "Location",
            message:
              "Attendance Location must start with a branch code for matched Egypt Picker rows."
          })
        );
      } else {
        const vendorMatch = vendorMatches.get(reported.code);

        if (!vendorMatch) {
          context.locationMappingStatus =
            AttendanceLocationMappingStatus.UNMAPPED;
          unmappedLocationRows += 1;
          issues.push(
            locationIssue({
              row,
              severity: AttendanceIssueSeverity.WARNING,
              issueCode: AttendanceIssueCode.UNMAPPED_ATTENDANCE_LOCATION,
              fieldName: "Location",
              message:
                "Attendance Location code is not mapped to a vendor code or external vendor id."
            })
          );
        } else {
          const vendor = vendorMatch.vendor;
          context.reportedVendorId = vendor.id;
          context.reportedChainId = vendor.chainId;
          context.locationMappingStatus = vendorMatch.mappingStatus;
          context.vendorName = vendor.vendorName;
          context.chainName = vendor.chain.chainName;
          mappedLocationRows += 1;

          if (shouldCompareActiveAssignments) {
            if (user.personRole === AttendancePersonRole.CHAMP) {
              // Champ attendance is always calculated on the reported Location
              // branch. We only warn (never block) when the champ has no active
              // VendorChampAssignment to that specific reported branch.
              const assignedVendorIds = champActiveVendorIds.get(user.id);
              if (assignedVendorIds && assignedVendorIds.has(vendor.id)) {
                context.assignmentMismatchStatus =
                  AttendanceAssignmentMismatchStatus.MATCHES_ACTIVE_ASSIGNMENT;
              } else {
                context.assignmentMismatchStatus =
                  assignedVendorIds && assignedVendorIds.size > 0
                    ? AttendanceAssignmentMismatchStatus.DIFFERS_FROM_ACTIVE_ASSIGNMENT
                    : AttendanceAssignmentMismatchStatus.NO_ACTIVE_ASSIGNMENT;
                activeAssignmentMismatchRows += 1;
                issues.push(
                  locationIssue({
                    row,
                    severity: AttendanceIssueSeverity.WARNING,
                    issueCode: AttendanceIssueCode.ACTIVE_ASSIGNMENT_MISMATCH,
                    fieldName: "Location",
                    message:
                      "Champ has no active branch assignment to the reported attendance Location branch (row is still calculated on the reported branch)."
                  })
                );
              }
            } else {
              const activeVendorId = activeAssignments.get(user.id) ?? null;
              if (!activeVendorId) {
                context.assignmentMismatchStatus =
                  AttendanceAssignmentMismatchStatus.NO_ACTIVE_ASSIGNMENT;
                activeAssignmentMismatchRows += 1;
                issues.push(
                  locationIssue({
                    row,
                    severity: AttendanceIssueSeverity.WARNING,
                    issueCode: AttendanceIssueCode.ACTIVE_ASSIGNMENT_MISMATCH,
                    fieldName: "Location",
                    message:
                      "Picker has no active branch assignment to compare with the reported attendance Location."
                  })
                );
              } else if (activeVendorId === vendor.id) {
                context.assignmentMismatchStatus =
                  AttendanceAssignmentMismatchStatus.MATCHES_ACTIVE_ASSIGNMENT;
              } else {
                context.assignmentMismatchStatus =
                  AttendanceAssignmentMismatchStatus.DIFFERS_FROM_ACTIVE_ASSIGNMENT;
                activeAssignmentMismatchRows += 1;
                issues.push(
                  locationIssue({
                    row,
                    severity: AttendanceIssueSeverity.WARNING,
                    issueCode: AttendanceIssueCode.ACTIVE_ASSIGNMENT_MISMATCH,
                    fieldName: "Location",
                    message:
                      "Reported attendance Location differs from the picker active branch assignment."
                  })
                );
              }
            }
          }
        }
      }

      if (reported.code && shift.code && reported.code !== shift.code) {
        locationShiftLocationDifferenceRows += 1;
        issues.push(
          locationIssue({
            row,
            severity: AttendanceIssueSeverity.WARNING,
            issueCode: AttendanceIssueCode.LOCATION_SHIFT_LOCATION_DIFFERENCE,
            fieldName: "Shift Location",
            message:
              "Attendance Location code differs from Shift Location code."
          })
        );
      }

      contextsByRawRowNumber.set(row.rawRowNumber, context);
    }

    return {
      issues,
      contextsByRawRowNumber,
      mappedLocationRows,
      unmappedLocationRows,
      missingLocationCodeRows,
      activeAssignmentMismatchRows,
      locationShiftLocationDifferenceRows,
      rowsByReportedLocationCode: buildReportedLocationGroups(
        contextsByRawRowNumber
      )
    };
  }

  private async loadVendorMatchesByLocationCode(codes: string[]) {
    if (codes.length === 0) {
      return new Map<string, AttendanceLocationVendorMatch>();
    }

    const vendors = await this.prisma.vendor.findMany({
      where: {
        OR: [
          {
            vendorCode: {
              in: codes
            }
          },
          {
            vendorExternalId: {
              in: codes
            }
          }
        ]
      },
      select: {
        id: true,
        vendorName: true,
        vendorCode: true,
        vendorExternalId: true,
        chainId: true,
        chain: {
          select: {
            id: true,
            chainName: true
          }
        }
      }
    });

    const byVendorCode = new Map<string, AttendanceLocationVendor>();
    const byVendorExternalId = new Map<string, AttendanceLocationVendor>();

    for (const vendor of vendors) {
      byVendorCode.set(vendor.vendorCode, vendor);
      if (vendor.vendorExternalId) {
        byVendorExternalId.set(vendor.vendorExternalId, vendor);
      }
    }

    const matches = new Map<string, AttendanceLocationVendorMatch>();
    for (const code of codes) {
      const vendorByCode = byVendorCode.get(code);
      if (vendorByCode) {
        matches.set(code, {
          vendor: vendorByCode,
          mappingStatus: AttendanceLocationMappingStatus.MAPPED_VENDOR_CODE
        });
        continue;
      }

      const vendorByExternalId = byVendorExternalId.get(code);
      if (vendorByExternalId) {
        matches.set(code, {
          vendor: vendorByExternalId,
          mappingStatus:
            AttendanceLocationMappingStatus.MAPPED_VENDOR_EXTERNAL_ID
        });
      }
    }

    return matches;
  }

  private async loadActiveAssignmentsByPickerId(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, string>();
    }

    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: {
        pickerId: {
          in: userIds
        },
        status: AssignmentStatus.ACTIVE
      },
      orderBy: [
        {
          startDate: "desc"
        },
        {
          createdAt: "desc"
        }
      ],
      select: {
        pickerId: true,
        vendorId: true
      }
    });

    const activeAssignments = new Map<string, string>();
    for (const assignment of assignments) {
      if (!activeAssignments.has(assignment.pickerId)) {
        activeAssignments.set(assignment.pickerId, assignment.vendorId);
      }
    }

    return activeAssignments;
  }

  // Resolved, unambiguous matches keyed by sheet identifier. Picker (shopperId)
  // and Champ (ibsId) both flow; an identifier that matches both a picker and a
  // champ is dropped here (the validator already raised a blocking AMBIGUOUS
  // error, so such rows are never confirmable).
  private async loadMatchLookup(rows: AttendanceParsedRow[]) {
    const identifiers = Array.from(
      new Set(rows.map((row) => row.identifier).filter(Boolean) as string[])
    );
    const users = await this.userLookup.findByIdentifiers(identifiers);

    const pickerByIdentifier = new Map<string, AttendanceMatchedUser>();
    const champByIdentifier = new Map<string, AttendanceMatchedUser>();
    for (const user of users) {
      if (user.personRole === AttendancePersonRole.PICKER) {
        pickerByIdentifier.set(user.identifier, user);
      } else if (user.personRole === AttendancePersonRole.CHAMP) {
        champByIdentifier.set(user.identifier, user);
      }
    }

    const resolved = new Map<string, AttendanceMatchedUser>();
    for (const identifier of new Set([
      ...pickerByIdentifier.keys(),
      ...champByIdentifier.keys()
    ])) {
      const picker = pickerByIdentifier.get(identifier) ?? null;
      const champ = champByIdentifier.get(identifier) ?? null;
      if (picker && champ && picker.id !== champ.id) {
        continue;
      }
      const matched = picker ?? champ;
      if (matched) {
        resolved.set(identifier, matched);
      }
    }

    return resolved;
  }

  private async loadActiveChampVendorIds(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, Set<string>>();
    }

    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: {
        champId: { in: userIds },
        status: AssignmentStatus.ACTIVE
      },
      select: { champId: true, vendorId: true }
    });

    const byChampId = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const existing = byChampId.get(assignment.champId) ?? new Set<string>();
      existing.add(assignment.vendorId);
      byChampId.set(assignment.champId, existing);
    }

    return byChampId;
  }
}

function assertAttendanceImportActor(actor: { role: UserRole }) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("You do not have permission for this action.");
  }
}

function assertConfirmableBatch(batch: {
  status: AttendanceImportBatchStatus;
  errorRows: number;
}) {
  if (batch.errorRows > 0) {
    throw new BadRequestException(
      "Attendance import batch has blocking validation errors."
    );
  }

  if (batch.status !== AttendanceImportBatchStatus.VALIDATED) {
    throw new BadRequestException(
      "Only validated attendance import batches can be confirmed."
    );
  }
}

function isMtdImportModeInput(value: AttendanceImportPreviewOptions["importMode"]) {
  return !value || value === AttendanceImportMode.MTD;
}

function buildCalculationRows(
  periodMonth: string,
  parsedRows: AttendanceParsedRow[],
  matchedUsers: Map<string, AttendanceMatchedUser>,
  validationIssueCounts: Map<number, number>,
  duplicateSelections: Map<string, number> = new Map(),
  locationContexts: Map<number, AttendanceRowLocationContext> = new Map()
): AttendanceCalculationInputRow[] {
  return parsedRows
    .map((row): AttendanceCalculationInputRow | null => {
      if (!row.identifier || !row.shiftDate || !isEgypt(row.division)) {
        return null;
      }

      const user = matchedUsers.get(row.identifier);

      if (!user) {
        return null;
      }

      const duplicateSelection = duplicateSelections.get(matchedKey(row, user));
      if (duplicateSelection && duplicateSelection !== row.rawRowNumber) {
        return null;
      }

      const locationContext =
        locationContexts.get(row.rawRowNumber) ?? defaultLocationContext(row);
      const isChamp = user.personRole === AttendancePersonRole.CHAMP;

      return {
        periodMonth,
        shiftDate: row.shiftDate,
        shopperId: isChamp ? null : row.identifier,
        personRole: user.personRole,
        identifierType: user.identifierType,
        identifierValue: row.identifier,
        personNameSnapshot: user.nameEn,
        userId: user.id,
        pickerNameSnapshot: user.nameEn,
        sourceName: row.sourceName,
        sourceDesignation: row.sourceDesignation,
        division: row.division ?? "",
        sourceSubDivision: row.sourceSubDivision,
        sourceLocation: row.sourceLocation,
        sourceLocationCode: row.sourceLocationCode,
        reportedVendorId: locationContext.reportedVendorId,
        reportedChainId: locationContext.reportedChainId,
        reportedLocationCode: locationContext.reportedLocationCode,
        reportedLocationName: locationContext.reportedLocationName,
        reportedLocationRaw: locationContext.reportedLocationRaw,
        shiftLocationCode: locationContext.shiftLocationCode,
        shiftLocationName: locationContext.shiftLocationName,
        shiftLocationRaw: locationContext.shiftLocationRaw,
        locationMappingStatus: locationContext.locationMappingStatus,
        assignmentMismatchStatus: locationContext.assignmentMismatchStatus,
        shiftName: row.shiftName,
        scheduledStartTime: row.scheduledStartTime,
        scheduledEndTime: row.scheduledEndTime,
        scheduledShiftHours: row.scheduledShiftHours,
        breakDurationMins: row.breakDurationMins,
        actualCheckinTime: row.actualCheckinTime,
        actualCheckoutTime: row.actualCheckoutTime,
        actualWorkDurationHours: row.actualWorkDurationHours,
        sourceStatus: row.sourceStatus,
        matchStatus: isChamp
          ? AttendanceMatchStatus.MATCHED_CHAMP
          : AttendanceMatchStatus.MATCHED_PICKER,
        rawRowNumber: row.rawRowNumber,
        issuesCount: validationIssueCounts.get(row.rawRowNumber) ?? 0
      };
    })
    .filter((row): row is AttendanceCalculationInputRow => row !== null);
}

function buildMappableRows(
  parsedRows: AttendanceParsedRow[],
  matchedUsers: Map<string, AttendanceMatchedUser>,
  duplicateSelections: Map<string, number>
) {
  const rows: Array<{
    row: AttendanceParsedRow;
    user: AttendanceMatchedUser;
  }> = [];

  for (const row of parsedRows) {
    if (!row.identifier || !row.shiftDate || !isEgypt(row.division)) {
      continue;
    }

    const user = matchedUsers.get(row.identifier);

    if (!user) {
      continue;
    }

    const duplicateSelection = duplicateSelections.get(matchedKey(row, user));
    if (duplicateSelection && duplicateSelection !== row.rawRowNumber) {
      continue;
    }

    rows.push({ row, user });
  }

  return rows;
}

function selectedDuplicateRowsByMatchedKey(
  parsedRows: AttendanceParsedRow[],
  matchedUsers: Map<string, AttendanceMatchedUser>,
  selectedRows: Set<number>
) {
  const rowsByKey = new Map<string, AttendanceParsedRow[]>();

  for (const row of parsedRows) {
    if (!row.identifier || !row.shiftDate) {
      continue;
    }

    const user = matchedUsers.get(row.identifier);
    if (!user || !isEgypt(row.division)) {
      continue;
    }

    const key = matchedKey(row, user);
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
  }

  const selections = new Map<string, number>();
  for (const [key, rows] of rowsByKey) {
    if (rows.length < 2) {
      continue;
    }

    const selected = rows
      .map((row) => row.rawRowNumber)
      .filter((rowNumber) => selectedRows.has(rowNumber));

    if (selected.length === 1 && selected[0] !== undefined) {
      selections.set(key, selected[0]);
    }
  }

  return selections;
}

function matchedKey(row: AttendanceParsedRow, user: AttendanceMatchedUser) {
  return `matched:${row.shiftDate}:${user.id}`;
}

function countIssuesByRow(issues: AttendancePersistedIssue[]) {
  const counts = new Map<number, number>();

  for (const issue of issues) {
    if (issue.rowNumber !== null) {
      counts.set(issue.rowNumber, (counts.get(issue.rowNumber) ?? 0) + 1);
    }
  }

  return counts;
}

function countIssueRows(
  issues: AttendancePersistedIssue[],
  severity: AttendanceIssueSeverity
) {
  const rowNumbers = new Set<number>();
  let fileIssueCount = 0;

  for (const issue of issues) {
    if (issue.severity !== severity) {
      continue;
    }

    if (issue.rowNumber === null) {
      fileIssueCount += 1;
      continue;
    }

    rowNumbers.add(issue.rowNumber);
  }

  return rowNumbers.size + fileIssueCount;
}

function defaultLocationContext(
  row: AttendanceParsedRow
): AttendanceRowLocationContext {
  const reported = parseAttendanceLocation(row.sourceLocation);
  const shift = parseAttendanceLocation(row.shiftLocation);

  return {
    reportedVendorId: null,
    reportedChainId: null,
    reportedLocationCode: reported.code,
    reportedLocationName: reported.name,
    reportedLocationRaw: reported.raw,
    shiftLocationCode: shift.code,
    shiftLocationName: shift.name,
    shiftLocationRaw: shift.raw,
    locationMappingStatus: AttendanceLocationMappingStatus.NOT_CHECKED,
    assignmentMismatchStatus:
      AttendanceAssignmentMismatchStatus.NOT_CHECKED,
    vendorName: null,
    chainName: null
  };
}

function locationIssue(options: {
  row: AttendanceParsedRow;
  severity: AttendanceIssueSeverity;
  issueCode: AttendanceIssueCode;
  fieldName: string;
  message: string;
}): AttendancePreviewIssue {
  return {
    rowNumber: options.row.rawRowNumber,
    shopperId: options.row.identifier,
    severity: options.severity,
    issueCode: options.issueCode,
    fieldName: options.fieldName,
    message: options.message,
    resolutionStatus: AttendanceIssueResolutionStatus.OPEN
  };
}

function buildReportedLocationGroups(
  contextsByRawRowNumber: Map<number, AttendanceRowLocationContext>
): AttendanceReportedLocationSummary[] {
  const groups = new Map<string, AttendanceReportedLocationSummary>();

  for (const context of contextsByRawRowNumber.values()) {
    const key = [
      context.reportedLocationCode ?? "",
      context.reportedLocationName ?? "",
      context.reportedVendorId ?? "",
      context.locationMappingStatus
    ].join("|");
    const existing = groups.get(key);

    if (existing) {
      existing.rowCount += 1;
      continue;
    }

    groups.set(key, {
      code: context.reportedLocationCode,
      name: context.reportedLocationName,
      vendorId: context.reportedVendorId,
      vendorName: context.vendorName,
      chainId: context.reportedChainId,
      chainName: context.chainName,
      rowCount: 1,
      mappingStatus: context.locationMappingStatus
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftCode = left.code ?? "";
    const rightCode = right.code ?? "";
    if (leftCode !== rightCode) {
      return leftCode.localeCompare(rightCode);
    }

    return (left.name ?? "").localeCompare(right.name ?? "");
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function mapDailyRecordForCreate(
  importBatchId: string,
  record: import("./attendance-calculation.types").AttendanceDailyCalculationRecord
): Prisma.AttendanceDailyRecordCreateManyInput {
  return {
    importBatchId,
    periodMonth: record.periodMonth,
    shiftDate: dateOnlyToUtcDate(record.shiftDate, "shiftDate"),
    shopperId: record.shopperId,
    personRole: record.personRole,
    identifierType: record.identifierType,
    identifierValue: record.identifierValue,
    personNameSnapshot: record.personNameSnapshot,
    userId: record.userId,
    pickerNameSnapshot: record.pickerNameSnapshot,
    sourceName: record.sourceName,
    sourceDesignation: record.sourceDesignation,
    division: record.division,
    sourceSubDivision: record.sourceSubDivision,
    sourceLocation: record.sourceLocation,
    sourceLocationCode: record.sourceLocationCode,
    reportedVendorId: record.reportedVendorId,
    reportedChainId: record.reportedChainId,
    reportedLocationCode: record.reportedLocationCode,
    reportedLocationName: record.reportedLocationName,
    reportedLocationRaw: record.reportedLocationRaw,
    shiftLocationCode: record.shiftLocationCode,
    shiftLocationName: record.shiftLocationName,
    shiftLocationRaw: record.shiftLocationRaw,
    locationMappingStatus: record.locationMappingStatus,
    assignmentMismatchStatus: record.assignmentMismatchStatus,
    shiftName: record.shiftName,
    scheduledStartTime: record.scheduledStartTime,
    scheduledEndTime: record.scheduledEndTime,
    scheduledStartAt: isoDateTimeToDateOrNull(
      record.scheduledStartAt,
      "scheduledStartAt"
    ),
    scheduledEndAt: isoDateTimeToDateOrNull(
      record.scheduledEndAt,
      "scheduledEndAt"
    ),
    scheduledShiftHours: decimalOrNull(record.scheduledShiftHours),
    breakDurationMins: record.breakDurationMins,
    actualCheckinTime: timeOnlyToDateOrNull(
      record.shiftDate,
      record.actualCheckinTime,
      "actualCheckinTime"
    ),
    actualCheckoutTime: timeOnlyToDateOrNull(
      record.shiftDate,
      record.actualCheckoutTime,
      "actualCheckoutTime"
    ),
    actualWorkDurationHours: decimalOrNull(record.actualWorkDurationHours),
    sourceStatus: record.sourceStatus,
    calculatedStatus: record.calculatedStatus,
    rawLateMins: record.rawLateMins,
    graceMins: record.graceMins,
    chargeableLateMins: record.chargeableLateMins,
    lateBucket: record.lateBucket,
    isLate: record.isLate,
    isOnTime: record.isOnTime,
    isAbsent: record.isAbsent,
    isOffDay: record.isOffDay,
    isOnLeave: record.isOnLeave,
    leaveType: record.leaveType,
    isAnnualLeave: record.isAnnualLeave,
    isMedicalLeave: record.isMedicalLeave,
    isWorkingDay: record.isWorkingDay,
    isUnder8Hours: record.isUnder8Hours,
    isOver15Hours: record.isOver15Hours,
    matchStatus: record.matchStatus,
    rawRowNumber: record.rawRowNumber,
    rowHash: record.rowHash,
    issuesCount: record.issuesCount
  };
}

function mapMonthlySummaryForCreate(
  sourceBatchId: string,
  summary: import("./attendance-calculation.types").AttendancePickerMonthlyCalculationSummary
): Prisma.AttendancePickerMonthlySummaryCreateManyInput {
  return {
    sourceBatchId,
    periodMonth: summary.periodMonth,
    shopperId: summary.shopperId,
    personRole: summary.personRole,
    identifierType: summary.identifierType,
    identifierValue: summary.identifierValue,
    personNameSnapshot: summary.personNameSnapshot,
    userId: summary.userId,
    pickerNameSnapshot: summary.pickerNameSnapshot,
    totalScheduledRows: summary.totalScheduledRows,
    totalWorkingDays: summary.totalWorkingDays,
    onTimeDays: summary.onTimeDays,
    lateDays: summary.lateDays,
    totalRawLateMins: summary.totalRawLateMins,
    totalChargeableLateMins: summary.totalChargeableLateMins,
    late1Count: summary.late1Count,
    late2Count: summary.late2Count,
    late3Count: summary.late3Count,
    absentCount: summary.absentCount,
    leaveCount: summary.leaveCount,
    annualLeaveCount: summary.annualLeaveCount,
    medicalLeaveCount: summary.medicalLeaveCount,
    otherLeaveCount: summary.otherLeaveCount,
    offDayCount: summary.offDayCount,
    under8HoursCount: summary.under8HoursCount,
    over15HoursCount: summary.over15HoursCount,
    firstShiftDate: dateOnlyToUtcDateOrNull(summary.firstShiftDate),
    lastShiftDate: dateOnlyToUtcDateOrNull(summary.lastShiftDate),
    lastCalculatedAt: isoDateTimeToDate(summary.lastCalculatedAt, "lastCalculatedAt")
  };
}

async function writeConfirmAuditLogs(
  tx: AttendancePrismaTransaction,
  metadata: {
    actorUserId: string;
    batchId: string;
    importMode: AttendanceImportMode;
    periodMonth: string;
    coverageStartDate: string | null;
    coverageEndDate: string | null;
    expectedCoverageEndDate: string | null;
    rowCount: number;
    errorRows: number;
    warningRows: number;
    previousActiveBatchId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  const auditValue = toAuditJson(metadata);

  await tx.auditLog.create({
    data: {
      actorUserId: metadata.actorUserId,
      action: "ATTENDANCE_IMPORT_CONFIRMED",
      entityType: "AttendanceImportBatch",
      entityId: metadata.batchId,
      oldValue: Prisma.JsonNull,
      newValue: auditValue,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    }
  });

  if (metadata.previousActiveBatchId) {
    await tx.auditLog.create({
      data: {
        actorUserId: metadata.actorUserId,
        action: "ATTENDANCE_IMPORT_REPLACED_ACTIVE_BATCH",
        entityType: "AttendanceImportBatch",
        entityId: metadata.batchId,
        oldValue: Prisma.JsonNull,
        newValue: auditValue,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });
  }
}

function normalizeFileName(fileName: string) {
  const normalized = fileName.trim();
  return normalized || "attendance-import.xlsx";
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isEgypt(division: string | null) {
  return division?.trim().toUpperCase() === "EGYPT";
}

function normalizeDateTime(value: Date | string | undefined) {
  if (value instanceof Date) {
    assertValidDate(value, "now");
    return value;
  }

  if (typeof value === "string") {
    return isoDateTimeToDate(value, "now");
  }

  return new Date();
}

function periodMonthFromUploadDate(uploadDate: Date | string) {
  if (uploadDate instanceof Date) {
    assertValidDate(uploadDate, "uploadDate");
    return `${uploadDate.getFullYear()}-${pad(uploadDate.getMonth() + 1)}`;
  }

  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(uploadDate);

  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return isoDateTimeToDate(uploadDate, "uploadDate").toISOString().slice(0, 7);
}

function dateOnlyToUtcDate(value: string, fieldName: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return date;
}

function dateOnlyToUtcDateOrNull(value: string | null) {
  return value ? dateOnlyToUtcDate(value, "date") : null;
}

function isoDateTimeToDate(value: string, fieldName: string) {
  const date = new Date(value);
  assertValidDate(date, fieldName);
  return date;
}

function isoDateTimeToDateOrNull(value: string | null, fieldName: string) {
  return value ? isoDateTimeToDate(value, fieldName) : null;
}

function timeOnlyToDateOrNull(
  shiftDate: string,
  time: string | null,
  fieldName: string
) {
  if (!time) {
    return null;
  }

  if (!/^(\d{2}):(\d{2})$/.test(time)) {
    throw new BadRequestException(`${fieldName} must use HH:mm format.`);
  }

  return isoDateTimeToDate(`${shiftDate}T${time}:00.000Z`, fieldName);
}

function decimalOrNull(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value);
}

function assertValidDate(date: Date, fieldName: string) {
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }
}

function formatDateOnlyOrNull(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function toPrismaJson(previewResponse: unknown) {
  return JSON.parse(JSON.stringify(previewResponse)) as Prisma.InputJsonValue;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
