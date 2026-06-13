import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  AttendanceImportBatchStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import { AttendanceReportService } from "../src/attendance/attendance-report.service";

// These tests lock in the generic-identifier search (Fix 2) and generic-field
// sort (Fix 3) so a Champ (matched by ibsId / personNameSnapshot) is findable
// and orderable just like a Picker, without breaking the legacy fields.

type CapturedQuery = { where?: Record<string, unknown>; orderBy?: unknown };

function admin(): AuthenticatedUser {
  return {
    id: "admin-1",
    role: UserRole.ADMIN,
    nameEn: "Admin",
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function makeService() {
  const findManyQueries: CapturedQuery[] = [];
  const prisma = {
    attendanceImportBatch: {
      findFirst: async () => ({
        id: "batch-1",
        periodMonth: "2026-05",
        status: AttendanceImportBatchStatus.ACTIVE,
        coverageStartDate: new Date("2026-05-01T00:00:00.000Z"),
        coverageEndDate: new Date("2026-05-03T00:00:00.000Z"),
        expectedCoverageEndDate: new Date("2026-05-03T00:00:00.000Z"),
        confirmedAt: new Date("2026-05-04T10:00:00.000Z"),
        createdAt: new Date("2026-05-04T09:00:00.000Z")
      })
    },
    attendanceDailyRecord: {
      count: async () => 0,
      findMany: async (query: CapturedQuery) => {
        findManyQueries.push(query);
        return [];
      }
    }
  };

  return {
    findManyQueries,
    service: new AttendanceReportService(prisma as never)
  };
}

// The paginated rows query is the only findMany call that carries orderBy.
function rowsQuery(queries: CapturedQuery[]): CapturedQuery {
  const found = queries.find((query) => Array.isArray(query.orderBy));
  assert.ok(found, "expected a findMany call carrying orderBy (the rows query)");
  return found;
}

function hasContainsField(node: unknown, field: string): boolean {
  if (Array.isArray(node)) {
    return node.some((item) => hasContainsField(item, field));
  }

  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const candidate = obj[field];
    if (
      candidate &&
      typeof candidate === "object" &&
      "contains" in (candidate as Record<string, unknown>)
    ) {
      return true;
    }
    return Object.values(obj).some((value) => hasContainsField(value, field));
  }

  return false;
}

async function run() {
  // Fix 2: the legacy "shopperId" query param also matches the generic
  // identifierValue (a Champ ibsId), even without a free-text pickerSearch.
  {
    const { service, findManyQueries } = makeService();
    await service.getDailyReport(
      { periodMonth: "2026-05", shopperId: "IBS-CHAMP-7" },
      admin()
    );
    const where = rowsQuery(findManyQueries).where;
    assert.equal(hasContainsField(where, "identifierValue"), true);
    assert.equal(hasContainsField(where, "shopperId"), true);
    // personNameSnapshot is only added by pickerSearch, so it stays absent here.
    assert.equal(hasContainsField(where, "personNameSnapshot"), false);
  }

  // Fix 2: free-text search matches the generic person name + identifier so a
  // Champ is found by name or ibsId, while keeping the legacy fields too.
  {
    const { service, findManyQueries } = makeService();
    await service.getDailyReport(
      { periodMonth: "2026-05", pickerSearch: "Mostafa Champion" },
      admin()
    );
    const where = rowsQuery(findManyQueries).where;
    assert.equal(hasContainsField(where, "personNameSnapshot"), true);
    assert.equal(hasContainsField(where, "identifierValue"), true);
    assert.equal(hasContainsField(where, "pickerNameSnapshot"), true);
    assert.equal(hasContainsField(where, "shopperId"), true);
  }

  // Fix 3: name sort uses the generic personNameSnapshot, and the stable
  // tiebreakers are personNameSnapshot + identifierValue (not Picker-only).
  {
    const { service, findManyQueries } = makeService();
    await service.getDailyReport(
      { periodMonth: "2026-05", sortBy: "name", sortDirection: "desc" },
      admin()
    );
    const orderBy = rowsQuery(findManyQueries).orderBy as Array<
      Record<string, string>
    >;
    assert.equal(orderBy[0]?.personNameSnapshot, "desc");
    assert.equal(
      orderBy.some((entry) => "identifierValue" in entry),
      true
    );
    assert.equal(
      orderBy.some((entry) => "pickerNameSnapshot" in entry),
      false
    );
    assert.equal(
      orderBy.some((entry) => "shopperId" in entry),
      false
    );
  }

  // Fix 3: default ordering tiebreakers are the generic fields.
  {
    const { service, findManyQueries } = makeService();
    await service.getDailyReport({ periodMonth: "2026-05" }, admin());
    const orderBy = rowsQuery(findManyQueries).orderBy as Array<
      Record<string, string>
    >;
    assert.deepEqual(orderBy, [
      { shiftDate: "asc" },
      { personNameSnapshot: "asc" },
      { identifierValue: "asc" }
    ]);
  }
}

void run();
