import assert from "node:assert/strict";

import {
  AssignmentStatus,
  AttendanceImportMode,
  UserRole
} from "@prisma/client";

import { AttendanceHistoricalAssignmentBackfillService } from "../src/attendance/attendance-historical-assignment-backfill.service";
import { AttendanceLocationMapperService } from "../src/attendance/attendance-location-mapper.service";
import { AttendanceMatcherService } from "../src/attendance/attendance-matcher.service";
import type {
  HistoricalAssignmentBackfillProposal,
  ParsedAttendanceRow
} from "../src/attendance/attendance.types";

const pickerUser = {
  id: "picker-1",
  role: UserRole.PICKER,
  shopperId: "SHOP-1",
  ibsId: null,
  joiningDate: null
};
const champUser = {
  id: "champ-1",
  role: UserRole.CHAMP,
  shopperId: null,
  ibsId: "IBS-1",
  joiningDate: null
};
const vendorA = {
  id: "vendor-a",
  vendorExternalId: "740921",
  vendorName: "Carrefour Zahraa",
  chainId: "chain-a"
};
const vendorB = {
  id: "vendor-b",
  vendorExternalId: "612846",
  vendorName: "LuLu Tagammoa",
  chainId: "chain-b"
};

async function main() {
  await testPreviewProposesClosedHistoricalAssignment();
  await testPreviewIgnoresChampRows();
  await testPreviewReturnsUnmappedLocationWarning();
  await testPreviewReturnsConflictForDifferentCoveredVendor();
  await testConfirmCreatesClosedAssignment();
  await testConfirmRefusesOverlappingAndOpenEndedProposals();
}

async function testPreviewProposesClosedHistoricalAssignment() {
  const { service, createdAssignments } = createService();

  const preview = await service.previewHistoricalAssignmentBackfill({
    rows: [
      attendanceRow({
        rowNumber: 2,
        identifier: "SHOP-1",
        attendanceDate: new Date("2026-01-01T00:00:00.000Z"),
        rawLocation: "740921 - Carrefour, Zahraa El Maadi"
      }),
      attendanceRow({
        rowNumber: 3,
        identifier: "SHOP-1",
        attendanceDate: new Date("2026-01-02T00:00:00.000Z"),
        rawLocation: "740921 - Carrefour, Zahraa El Maadi"
      })
    ],
    periodFrom: new Date("2026-01-01T00:00:00.000Z"),
    periodTo: new Date("2026-01-31T00:00:00.000Z"),
    createdById: "admin-1",
    mode: AttendanceImportMode.HISTORICAL_BACKFILL
  });

  assert.equal(preview.totalRowsAnalyzed, 2);
  assert.equal(preview.matchedPickers, 2);
  assert.equal(preview.proposalsCount, 1);
  assert.equal(preview.proposals[0].pickerId, "picker-1");
  assert.equal(preview.proposals[0].vendorId, "vendor-a");
  assert.equal(
    preview.proposals[0].proposedStartDate.toISOString(),
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(
    preview.proposals[0].proposedEndDate.toISOString(),
    "2026-01-02T00:00:00.000Z"
  );
  assert.equal(preview.proposals[0].source, "ATTENDANCE_BACKFILL");
  assert.equal(createdAssignments.length, 0);
}

async function testPreviewIgnoresChampRows() {
  const { service } = createService();

  const preview = await service.previewHistoricalAssignmentBackfill({
    rows: [
      attendanceRow({
        identifier: "IBS-1",
        rawLocation: "740921 - Carrefour, Zahraa El Maadi"
      })
    ],
    periodFrom: new Date("2026-01-01T00:00:00.000Z"),
    periodTo: new Date("2026-01-31T00:00:00.000Z"),
    createdById: "admin-1",
    mode: AttendanceImportMode.HISTORICAL_BACKFILL
  });

  assert.equal(preview.ignoredChampRows, 1);
  assert.equal(preview.proposalsCount, 0);
}

async function testPreviewReturnsUnmappedLocationWarning() {
  const { service } = createService({ vendors: [vendorA] });

  const preview = await service.previewHistoricalAssignmentBackfill({
    rows: [
      attendanceRow({
        rawLocation: "999999 - Unknown Vendor"
      })
    ],
    periodFrom: new Date("2026-01-01T00:00:00.000Z"),
    periodTo: new Date("2026-01-31T00:00:00.000Z"),
    createdById: "admin-1",
    mode: AttendanceImportMode.HISTORICAL_BACKFILL
  });

  assert.equal(preview.unmappedLocationCount, 1);
  assert.equal(preview.proposalsCount, 0);
  assert.equal(preview.warnings[0].reason, "UNMAPPED_LOCATION_CODE");
}

async function testPreviewReturnsConflictForDifferentCoveredVendor() {
  const { service } = createService({
    assignments: [
      {
        id: "existing",
        pickerId: "picker-1",
        vendorId: "vendor-b",
        status: AssignmentStatus.CLOSED,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-01-31T00:00:00.000Z"),
        vendor: vendorB
      }
    ]
  });

  const preview = await service.previewHistoricalAssignmentBackfill({
    rows: [
      attendanceRow({
        rawLocation: "740921 - Carrefour, Zahraa El Maadi"
      })
    ],
    periodFrom: new Date("2026-01-01T00:00:00.000Z"),
    periodTo: new Date("2026-01-31T00:00:00.000Z"),
    createdById: "admin-1",
    mode: AttendanceImportMode.HISTORICAL_BACKFILL
  });

  assert.equal(preview.conflictCount, 1);
  assert.equal(preview.proposalsCount, 0);
  assert.equal(preview.conflicts[0].reason, "EXISTING_ASSIGNMENT_DIFFERENT_VENDOR");
}

async function testConfirmCreatesClosedAssignment() {
  const { service, createdAssignments, updatedAssignments } = createService();

  const result = await service.confirmHistoricalAssignmentBackfill({
    proposals: [proposal()],
    confirmedById: "admin-1",
    referenceDate: new Date("2026-02-01T00:00:00.000Z")
  });

  assert.equal(result.createdCount, 1);
  assert.equal(result.conflictCount, 0);
  assert.equal(createdAssignments.length, 1);
  assert.equal(createdAssignments[0].pickerId, "picker-1");
  assert.equal(createdAssignments[0].vendorId, "vendor-a");
  assert.equal(createdAssignments[0].status, AssignmentStatus.CLOSED);
  assert.equal(createdAssignments[0].endDate.toISOString(), "2026-01-31T00:00:00.000Z");
  assert.equal(updatedAssignments.length, 0);
}

async function testConfirmRefusesOverlappingAndOpenEndedProposals() {
  const { service, createdAssignments, updatedAssignments } = createService({
    assignments: [
      {
        id: "current-active",
        pickerId: "picker-1",
        vendorId: "vendor-b",
        status: AssignmentStatus.ACTIVE,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        endDate: null,
        vendor: vendorB
      }
    ]
  });

  const result = await service.confirmHistoricalAssignmentBackfill({
    proposals: [
      proposal(),
      {
        ...proposal(),
        vendorId: "vendor-b",
        proposedStartDate: new Date("2025-12-01T00:00:00.000Z"),
        proposedEndDate: null as never
      }
    ],
    confirmedById: "admin-1",
    referenceDate: new Date("2026-02-01T00:00:00.000Z")
  });

  assert.equal(result.createdCount, 0);
  assert.equal(result.conflictCount, 2);
  assert.equal(createdAssignments.length, 0);
  assert.equal(updatedAssignments.length, 0);
}

function createService(options: {
  users?: typeof pickerUser[];
  vendors?: typeof vendorA[];
  assignments?: Array<Record<string, any>>;
} = {}) {
  const users = options.users ?? [pickerUser, champUser];
  const vendors = options.vendors ?? [vendorA, vendorB];
  const assignments = options.assignments ?? [];
  const createdAssignments: Array<Record<string, any>> = [];
  const updatedAssignments: Array<Record<string, any>> = [];

  const prisma = {
    user: {
      findMany: async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        const identifiers = new Set<string>();
        for (const clause of where.OR) {
          const shopper = clause.shopperId as { in?: string[] } | string | undefined;
          const ibs = clause.ibsId as { in?: string[] } | string | undefined;
          if (typeof shopper === "string") identifiers.add(shopper);
          if (typeof ibs === "string") identifiers.add(ibs);
          shopper?.in?.forEach((value) => identifiers.add(value));
          ibs?.in?.forEach((value) => identifiers.add(value));
        }

        return users.filter(
          (user) =>
            (user.shopperId && identifiers.has(user.shopperId)) ||
            (user.ibsId && identifiers.has(user.ibsId))
        );
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((user) => user.id === where.id) ?? null
    },
    vendor: {
      findMany: async ({ where }: { where: { vendorExternalId?: { in?: string[] } } }) => {
        const externalIds = new Set(where.vendorExternalId?.in ?? []);
        return vendors.filter(
          (vendor) => vendor.vendorExternalId && externalIds.has(vendor.vendorExternalId)
        );
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        vendors.find((vendor) => vendor.id === where.id) ?? null
    },
    pickerBranchAssignment: {
      findMany: async ({ where }: { where: Record<string, any> }) =>
        assignments.filter((assignment) => overlapsWhere(assignment, where)),
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        assignments.find((assignment) => overlapsWhere(assignment, where)) ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        createdAssignments.push(data);
        return {
          id: `created-${createdAssignments.length}`,
          ...data
        };
      },
      update: async (input: Record<string, any>) => {
        updatedAssignments.push(input);
        return input;
      }
    }
  };

  const matcher = new AttendanceMatcherService(prisma as never);
  const service = new AttendanceHistoricalAssignmentBackfillService(
    prisma as never,
    { parseAttendanceBuffer: async () => ({ rows: [], issues: [] }) } as never,
    matcher,
    new AttendanceLocationMapperService()
  );

  return { service, createdAssignments, updatedAssignments };
}

function overlapsWhere(assignment: Record<string, any>, where: Record<string, any>) {
  const pickerIds: string[] =
    where.pickerId?.in ?? (where.pickerId ? [where.pickerId] : []);
  if (pickerIds.length && !pickerIds.includes(assignment.pickerId)) return false;

  const queryStart = where.OR?.[0]?.endDate?.gte ?? where.OR?.[1]?.endDate?.gte;
  const queryEnd = where.startDate?.lte;
  if (!queryStart || !queryEnd) return true;

  return (
    assignment.startDate <= queryEnd &&
    (assignment.endDate === null || assignment.endDate >= queryStart)
  );
}

function attendanceRow(overrides: Partial<ParsedAttendanceRow> = {}): ParsedAttendanceRow {
  return {
    rowNumber: 2,
    rawName: "Picker One",
    identifier: "SHOP-1",
    rawDesignation: "Picker",
    department: "Ops",
    division: "Egypt",
    subDivision: null,
    rawLocation: "740921 - Carrefour, Zahraa El Maadi",
    rawRole: "Picker",
    jobType: null,
    employeeCurrentStatus: "Active",
    shiftName: "Morning Shift",
    attendanceDate: new Date("2026-01-01T00:00:00.000Z"),
    scheduledStartAt: new Date("2026-01-01T09:00:00.000Z"),
    scheduledEndAt: new Date("2026-01-01T17:00:00.000Z"),
    actualCheckInAt: new Date("2026-01-01T09:00:00.000Z"),
    actualCheckOutAt: new Date("2026-01-01T17:00:00.000Z"),
    totalHoursInShift: 8,
    actualWorkDurationHours: 8,
    rawStatus: "On Time",
    ...overrides
  };
}

function proposal(
  overrides: Partial<HistoricalAssignmentBackfillProposal> = {}
): HistoricalAssignmentBackfillProposal {
  return {
    pickerId: "picker-1",
    identifier: "SHOP-1",
    vendorId: "vendor-a",
    vendorExternalId: "740921",
    vendorName: "Carrefour Zahraa",
    chainId: "chain-a",
    proposedStartDate: new Date("2026-01-01T00:00:00.000Z"),
    proposedEndDate: new Date("2026-01-31T00:00:00.000Z"),
    source: "ATTENDANCE_BACKFILL",
    evidenceCount: 31,
    ...overrides
  };
}

void main();
