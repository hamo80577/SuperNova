# Admin Performance Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a read-only Admin/Super Admin performance-summary API and typed frontend API client for global or chain/branch-scoped operational reporting.

**Architecture:** A dedicated AdminPerformanceSummaryService owns all Admin aggregation logic and uses Prisma assignment tables for scope, confirmed Orders KPI batches for UHO, active attendance batches for clean-shift health, and request state/timestamps for ticket metrics. WorkspacesController remains a thin role-protected adapter; existing role summaries remain unchanged and the result bypasses the canonical monthly cache.

**Tech Stack:** NestJS 11, TypeScript, Prisma 6, PostgreSQL, class-validator, Node assert/tsx focused tests, Next.js API request utilities.

---

## Current State and Reuse Boundaries

- GET /workspaces/admin currently returns organization counts and recent entities; it has no performance analytics.
- AreaManagerPerformanceSummaryService supplies proven patterns for date parsing, confirmed KPI filtering, active attendance filtering, target evaluation, clean-shift health, and controller wiring.
- The Admin implementation reproduces these rules in a dedicated service instead of extracting or changing existing role-summary engines.
- Scope comes from active ChainAreaManagerAssignment, VendorChampAssignment, and PickerBranchAssignment records.
- Requests match source or destination chain/vendor. waitingMyAction uses PENDING_ADMIN plus ADMIN_FINAL_APPROVAL. updatedAt is never a close timestamp.
- The only frontend change is a typed API client. No page or component changes are permitted.

## File Map

- Create: apps/api/test/admin-performance-summary.test.ts
- Create: apps/api/src/workspaces/dto/admin-performance-summary-query.dto.ts
- Create: apps/api/src/workspaces/admin-performance-summary.service.ts
- Modify: apps/api/src/workspaces/workspaces.controller.ts
- Modify: apps/api/src/workspaces/workspaces.module.ts
- Create: apps/web/lib/api/admin-performance.ts

### Task 1: Lock the Contract with Failing Tests

**Files:**
- Create: apps/api/test/admin-performance-summary.test.ts

- [ ] **Step 1: Create deterministic fixtures and a minimal Prisma stub**

Fixtures contain two chains, three vendors, two Area Managers, two Champs, at least twelve Pickers, active assignments, confirmed and unconfirmed KPI rows, active attendance, and request rows covering every approved ticket state. The stub exposes only:

~~~ts
const prisma = {
  chain: { findMany, findUnique },
  vendor: { findMany, findUnique },
  chainAreaManagerAssignment: { findMany },
  vendorChampAssignment: { findMany },
  pickerBranchAssignment: { findMany },
  ordersKpiDailyRecord: { findMany },
  attendanceDailyRecord: { findMany },
  request: { count }
};
~~~

The target-settings stub returns source SAVED and uhoRateTarget 8. An unconfirmed KPI row uses large values so accidental inclusion fails totals.

- [ ] **Step 2: Add and invoke all required cases**

~~~ts
await testEndpointAllowsAdminAndSuperAdminOnly();
await testAdminCanReadGlobalSummary();
await testSuperAdminUsesTheSameSummaryContract();
await testChainFilterNarrowsEverySection();
await testVendorFilterNarrowsEverySection();
await testVendorMustBelongToSelectedChain();
await testOnlyConfirmedKpiBatchesAreIncluded();
await testAttendanceIncludesPickersAndChamps();
await testAttendanceUsesCleanShiftRate();
await testTicketSummaryUsesApprovedTimeSemantics();
await testAreaManagersRankByUhoOnly();
await testChampsRankByUhoOnly();
await testBranchesRankByUhoOnly();
await testTopPickersExcludeLowVolumeRows();
await testScopeFiltersAffectRankingsAndTopPickers();
~~~

Assertions must prove UHO ascending order, name-only tie-breaking, NO_KPI after valid KPI, seven-day minOrdersRequired 20, totalTickets equals openedInPeriod, completedAt drives closedInPeriod, and historical open/pending-admin rows ignore the selected period.

- [ ] **Step 3: Verify RED**

Run:

~~~powershell
npx tsx apps/api/test/admin-performance-summary.test.ts
~~~

Expected: module-not-found or missing-handler failure.

- [ ] **Step 4: Commit the failing test**

~~~powershell
git add apps/api/test/admin-performance-summary.test.ts
git commit -m "test: define admin performance summary contract"
~~~

### Task 2: Add DTO and Thin Route Wiring

**Files:**
- Create: apps/api/src/workspaces/dto/admin-performance-summary-query.dto.ts
- Modify: apps/api/src/workspaces/workspaces.controller.ts
- Modify: apps/api/src/workspaces/workspaces.module.ts

- [ ] **Step 1: Create the query DTO**

~~~ts
import { IsOptional, IsString, Matches } from "class-validator";

export class AdminPerformanceSummaryQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo!: string;

  @IsOptional()
  @IsString()
  chainId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}
~~~

- [ ] **Step 2: Inject the service and expose the endpoint**

~~~ts
@Get("admin/performance-summary")
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
getAdminPerformanceSummary(
  @Query() query: AdminPerformanceSummaryQueryDto
) {
  return this.adminPerformanceSummaryService.getSummary(query);
}
~~~

- [ ] **Step 3: Register AdminPerformanceSummaryService**

Add it to WorkspacesModule providers and exports. Reuse the existing OrdersKpisModule import, which exports OrdersKpisTargetSettingsService.

- [ ] **Step 4: Re-run the focused test**

Expected: role metadata passes; service behavior remains RED.

- [ ] **Step 5: Commit route wiring**

~~~powershell
git add apps/api/src/workspaces/dto/admin-performance-summary-query.dto.ts apps/api/src/workspaces/workspaces.controller.ts apps/api/src/workspaces/workspaces.module.ts
git commit -m "feat: expose admin performance summary endpoint"
~~~

### Task 3: Implement Scope Validation and Read Queries

**Files:**
- Create: apps/api/src/workspaces/admin-performance-summary.service.ts
- Test: apps/api/test/admin-performance-summary.test.ts

- [ ] **Step 1: Define the exact approved response interfaces**

Include AdminPerformanceSummary, AdminAreaManagerRankRow, AdminChampRankRow, AdminBranchRankRow, AdminTopPickerRow, and:

~~~ts
export type AdminPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";
~~~

- [ ] **Step 2: Parse and validate input**

Implement real-calendar-date parsing, inclusive date range handling, and dateFrom <= dateTo. Normalize empty optional IDs. A missing chain/vendor or mismatched pair throws BadRequestException without leaking entity data.

- [ ] **Step 3: Build assignment-backed scope**

Load active chains/vendors and active assignment rows, then deduplicate IDs into:

~~~ts
type AdminScope = {
  chains: Array<{ chainId: string; chainName: string }>;
  branches: Array<{
    vendorId: string;
    vendorName: string;
    chainId: string;
    chainName: string;
  }>;
  areaManagerIds: string[];
  champIds: string[];
  pickerIds: string[];
  scopedUserIds: string[];
};
~~~

Apply chainId/vendorId before totals and data queries. Selector chains remain available globally; selector branches narrow to the selected chain. All metrics use the selected scope.

- [ ] **Step 4: Add bounded Prisma reads**

Orders KPI where clause:

~~~ts
{
  kpiDate: { gte: dateFromValue, lt: dateToExclusive },
  matchedVendorId: { in: scopeVendorIds },
  vendorMatchStatus: OrdersKpiVendorMatchStatus.MATCHED,
  sourceBatch: { is: { status: OrdersKpiImportBatchStatus.CONFIRMED } }
}
~~~

Attendance uses scoped Picker and Champ IDs plus ACTIVE import batches. Request counts share a source/destination chain/vendor predicate. Empty scopes return empty results instead of broad unscoped queries.

- [ ] **Step 5: Implement approved ticket counts**

Use createdAt for totalTickets/openedInPeriod and rejectedOrCancelled. Use completedAt plus APPROVED/COMPLETED for closedInPeriod. openNow uses current pending statuses regardless of date. waitingMyAction uses PENDING_ADMIN and ADMIN_FINAL_APPROVAL regardless of date.

- [ ] **Step 6: Run focused tests**

Expected: filter, confirmed-batch, attendance, and ticket tests pass; ranking tests remain RED.

### Task 4: Implement Aggregates, Rankings, Statuses, and Top Pickers

**Files:**
- Modify: apps/api/src/workspaces/admin-performance-summary.service.ts
- Test: apps/api/test/admin-performance-summary.test.ts

- [ ] **Step 1: Add file-local pure helpers**

Implement percentage, date grouping, KPI totals/trend, clean-shift attendance, target summary, and status evaluation. Preserve current operational thresholds:

~~~ts
if (totalOrders === 0) return "NO_KPI";
if (totalOrders < minOrdersRequired) return "LOW_VOLUME";
if (uhoOutOfTarget || attendanceHealthRate < 70) return "NEEDS_ACTION";
if (
  uhoAtLeastNinetyPercentOfTarget ||
  attendanceHealthRate < 85 ||
  issueShifts > 0
) return "WATCH";
return "IN_TARGET";
~~~

Target status is NO_TARGET when the settings source is not SAVED.

- [ ] **Step 2: Aggregate each ranking context**

Area Managers aggregate assigned chains; Champs aggregate assigned vendors; branches aggregate vendor records; Pickers aggregate matched userId. Every context is scope-limited and confirmed-KPI-only.

- [ ] **Step 3: Rank by UHO only**

~~~ts
function compareUhoThenName(
  left: { unhealthyRate: number | null; name: string },
  right: { unhealthyRate: number | null; name: string }
) {
  if (left.unhealthyRate === null) {
    return right.unhealthyRate === null
      ? left.name.localeCompare(right.name)
      : 1;
  }
  if (right.unhealthyRate === null) return -1;
  return left.unhealthyRate - right.unhealthyRate ||
    left.name.localeCompare(right.name);
}
~~~

Assign one-based ranks after sorting. Orders are context only and never a tie-breaker.

- [ ] **Step 4: Apply Top Picker volume thresholds**

Use inclusive range length: 1 day = 5; 2-7 = 20; 8-31 = 60; above 31 = 180. Filter before sorting, return at most ten, and report eligible count before slicing.

- [ ] **Step 5: Assemble the exact response**

Return period, filters, scopeTotals, ordersKpi, attendance, ticketsSummary, three UHO_ONLY rankings, and UHO_ONLY_WITH_MINIMUM_ORDERS topPickers. Empty valid scopes return available false plus a concise reason, not an exception.

- [ ] **Step 6: Verify GREEN and commit**

~~~powershell
npx tsx apps/api/test/admin-performance-summary.test.ts
git add apps/api/src/workspaces/admin-performance-summary.service.ts apps/api/test/admin-performance-summary.test.ts
git commit -m "feat: calculate admin performance summary"
~~~

Expected test output: admin performance summary tests passed.

### Task 5: Add the Typed Frontend API Client

**Files:**
- Create: apps/web/lib/api/admin-performance.ts

- [ ] **Step 1: Mirror the approved backend response types**

Keep optional and nullable fields identical to the endpoint contract. Do not import this file into any page or component.

- [ ] **Step 2: Add the thin request wrapper**

~~~ts
export const adminPerformanceApi = {
  summary(params: {
    dateFrom: string;
    dateTo: string;
    chainId?: string;
    vendorId?: string;
  }): Promise<AdminPerformanceSummary> {
    const query = new URLSearchParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });
    if (params.chainId) query.set("chainId", params.chainId);
    if (params.vendorId) query.set("vendorId", params.vendorId);

    return apiGet<AdminPerformanceSummary>(
      "/workspaces/admin/performance-summary?" + query.toString()
    );
  }
};
~~~

- [ ] **Step 3: Run typecheck and commit**

~~~powershell
npm run typecheck
git add apps/web/lib/api/admin-performance.ts
git commit -m "feat: add admin performance API client"
~~~

### Task 6: Verification and Scope Audit

**Files:**
- Review only: files changed in Tasks 1-5

- [ ] **Step 1: Run required checks**

~~~powershell
npx tsx apps/api/test/admin-performance-summary.test.ts
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
~~~

Every successful command must exit 0. If Prisma generation reports Windows EPERM, stop only the watcher locking the Prisma DLL and rerun it.

- [ ] **Step 2: Audit scope**

~~~powershell
git diff --check
git status --short
git diff --name-only de99049..HEAD
~~~

Confirm no Picker, Champ, Area Manager, workflow, assignment mutation, deduction policy, Prisma schema, or Admin UI file changed.

- [ ] **Step 3: Manual API verification when local services are available**

Call the endpoint as Admin and Super Admin using global, chain, and vendor filters. Confirm non-admin is 403, invalid dates/filter relationships are 400, and no write tables change.

