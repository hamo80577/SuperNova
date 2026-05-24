import assert from "node:assert/strict";

import { AssignmentStatus } from "@prisma/client";

import { AttendanceAssignmentSnapshotService } from "../src/attendance/attendance-assignment-snapshot.service";

const assignments = [
  {
    id: "assignment-old",
    pickerId: "picker-1",
    vendorId: "vendor-old",
    status: AssignmentStatus.CLOSED,
    startDate: new Date("2026-05-01T00:00:00.000Z"),
    endDate: new Date("2026-05-15T00:00:00.000Z"),
    vendor: {
      id: "vendor-old",
      chainId: "chain-old"
    }
  },
  {
    id: "assignment-new",
    pickerId: "picker-1",
    vendorId: "vendor-new",
    status: AssignmentStatus.ACTIVE,
    startDate: new Date("2026-05-16T00:00:00.000Z"),
    endDate: null,
    vendor: {
      id: "vendor-new",
      chainId: "chain-new"
    }
  }
];

const prisma = {
  pickerBranchAssignment: {
    findFirst: async ({ where, orderBy }: { where: Record<string, any>; orderBy: any }) => {
      assert.deepEqual(orderBy, { startDate: "desc" });

      return (
        assignments
          .filter((assignment) => assignment.pickerId === where.pickerId)
          .filter((assignment) => statusMatches(where.status, assignment.status))
          .filter(
            (assignment) =>
              assignment.startDate <= where.startDate.lte &&
              (assignment.endDate === null ||
                assignment.endDate >= where.OR[1].endDate.gte)
          )
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null
      );
    }
  }
};

async function main() {
  const service = new AttendanceAssignmentSnapshotService(prisma as never);

  const oldSnapshot = await service.resolvePickerSnapshot(
    "picker-1",
    new Date("2026-05-10T00:00:00.000Z")
  );
  assert.equal(oldSnapshot.assignmentVendorId, "vendor-old");
  assert.equal(oldSnapshot.assignmentChainId, "chain-old");

  const newSnapshot = await service.resolvePickerSnapshot(
    "picker-1",
    new Date("2026-05-20T00:00:00.000Z")
  );
  assert.equal(newSnapshot.assignmentVendorId, "vendor-new");
  assert.equal(newSnapshot.assignmentChainId, "chain-new");
}

function statusMatches(filter: unknown, status: AssignmentStatus) {
  if (!filter) return true;
  if (typeof filter === "string") return filter === status;
  if (typeof filter === "object" && filter && "in" in filter) {
    return (filter.in as AssignmentStatus[]).includes(status);
  }
  return false;
}

void main();
