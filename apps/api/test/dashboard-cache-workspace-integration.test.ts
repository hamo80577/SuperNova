import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import { AreaManagerPerformanceSummaryService } from "../src/workspaces/area-manager-performance-summary.service";
import { WorkspacesService } from "../src/workspaces/workspaces.service";

async function main() {
  const calls: Array<{ role: UserRole; userId: string }> = [];
  const cache = {
    getOrCalculate: async (input: {
      role: UserRole;
      userId: string;
      calculate: () => Promise<unknown>;
    }) => {
      calls.push({ role: input.role, userId: input.userId });
      return input.calculate();
    }
  };

  const workspaces = Object.create(WorkspacesService.prototype) as any;
  workspaces.dashboardCache = cache;
  workspaces.calculatePickerPerformanceSummary = async () => ({ picker: true });
  workspaces.calculateChampPerformanceSummary = async () => ({ champ: true });

  assert.deepEqual(
    await workspaces.getPickerPerformanceSummary("picker-1", {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-20",
      period: "THIS_MONTH"
    }),
    { picker: true }
  );
  assert.deepEqual(
    await workspaces.getChampPerformanceSummary("champ-1", {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-20"
    }),
    { champ: true }
  );

  const areaManager = Object.create(
    AreaManagerPerformanceSummaryService.prototype
  ) as any;
  areaManager.dashboardCache = cache;
  areaManager.calculateSummary = async () => ({ areaManager: true });

  assert.deepEqual(
    await areaManager.getSummary("area-manager-1", {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-20"
    }),
    { areaManager: true }
  );

  assert.deepEqual(calls, [
    { role: UserRole.PICKER, userId: "picker-1" },
    { role: UserRole.CHAMP, userId: "champ-1" },
    { role: UserRole.AREA_MANAGER, userId: "area-manager-1" }
  ]);

  console.log("Dashboard cache workspace integration tests passed.");
}

void main();
