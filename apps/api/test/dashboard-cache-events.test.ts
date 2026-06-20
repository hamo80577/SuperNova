import assert from "node:assert/strict";

import { AccountStatus, EmploymentStatus, UserRole } from "@prisma/client";

import { DashboardCacheEventsListener } from "../src/dashboard-cache/dashboard-cache-events.listener";
import { DashboardCacheQueueService } from "../src/dashboard-cache/dashboard-cache-queue.service";

async function main() {
  const queueAdds: Array<{
    name: string;
    data: unknown;
    options: Record<string, unknown>;
  }> = [];
  const queue = {
    add: async (
      name: string,
      data: unknown,
      options: Record<string, unknown>
    ) => {
      queueAdds.push({ name, data, options });
      return { id: options.jobId };
    }
  };
  const queueService = new DashboardCacheQueueService(queue as never);
  let findUniqueCalls = 0;
  let findManyCalls = 0;
  const prisma = {
    user: {
      findUnique: async () => {
        findUniqueCalls += 1;
        return {
          id: "picker-1",
          role: UserRole.PICKER,
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        };
      },
      findMany: async () => {
        findManyCalls += 1;
        return [];
      }
    }
  };
  const deletedKeys: string[] = [];
  const store = {
    delete: async (role: UserRole, userId: string, month: string) => {
      deletedKeys.push(
        `perf_summary:${role.toLowerCase()}:${userId}:${month}`
      );
      return true;
    }
  };
  const listener = new DashboardCacheEventsListener(
    prisma as never,
    store as never,
    queueService
  );

  await listener.onUserMetricsUpdated({
    eventId: "request-1",
    userId: "picker-1",
    month: "2026-06",
    source: "DEDUCTION"
  });

  assert.equal(findUniqueCalls, 1);
  assert.equal(findManyCalls, 0);
  assert.deepEqual(deletedKeys, [
    "perf_summary:picker:picker-1:2026-06"
  ]);
  assert.equal(queueAdds[0]?.name, "dashboard-cache.targeted");
  assert.equal(queueAdds[0]?.options.jobId, "targeted-deduction-request-1");
  assert.deepEqual(queueAdds[0]?.data, {
    kind: "TARGETED",
    eventId: "request-1",
    userId: "picker-1",
    month: "2026-06",
    source: "DEDUCTION"
  });

  await listener.onAttendanceImportSuccess({
    eventId: "attendance-batch-1",
    months: ["2026-06"],
    source: "ATTENDANCE_IMPORT"
  });

  assert.equal(queueAdds[1]?.name, "dashboard-cache.bulk");
  assert.equal(
    queueAdds[1]?.options.jobId,
    "bulk-attendance-import-attendance-batch-1"
  );

  await listener.onKpiImportSuccess({
    eventId: "kpi-batch-1",
    months: ["2026-05", "2026-06"],
    source: "KPI_IMPORT"
  });

  assert.equal(queueAdds[2]?.name, "dashboard-cache.bulk");
  assert.equal(queueAdds[2]?.options.jobId, "bulk-kpi-import-kpi-batch-1");

  console.log("Dashboard cache event tests passed.");
}

void main();
