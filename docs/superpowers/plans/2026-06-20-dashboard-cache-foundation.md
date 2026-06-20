# Dashboard Cache Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Redis-first canonical monthly performance-summary cache with BullMQ bulk warming for confirmed imports and strictly targeted warming for individual workflow changes.

**Architecture:** The API emits post-commit EventEmitter2 domain events. A listener invalidates an exact targeted key when applicable and dispatches deterministic jobs to a dedicated `dashboard-cache` BullMQ queue. The worker calculates through cache-bypassing workspace methods and writes JSON values through ioredis pipelines, while HTTP reads use Redis only for canonical unfiltered monthly requests and fall back safely to Prisma.

**Tech Stack:** NestJS 11, TypeScript, `@nestjs/event-emitter`, BullMQ, ioredis, Prisma, Node assert/tsx tests.

---

## File Structure

Create a focused `apps/api/src/dashboard-cache` module:

- `dashboard-cache.constants.ts`: event, queue, job, TTL, role, and chunk defaults.
- `dashboard-cache.types.ts`: domain event and queue payload discriminated unions.
- `dashboard-cache-key.ts`: exact key generation and canonical month-range validation.
- `dashboard-cache-store.service.ts`: resilient Redis JSON reads, exact invalidation, and pipeline writes.
- `dashboard-cache-read-through.service.ts`: canonical-only cache read/fallback/write orchestration.
- `dashboard-cache-queue.service.ts`: deterministic BullMQ dispatch.
- `dashboard-cache-events.listener.ts`: EventEmitter2 listener and targeted pre-enqueue invalidation.
- `dashboard-cache-warmer.service.ts`: targeted one-user calculation and cursor-based bulk warming.
- `dashboard-cache.processor.ts`: strict BullMQ job routing.
- `dashboard-cache.module.ts`: API-side Redis/store/queue/read-through providers.
- `dashboard-cache-worker.module.ts`: worker-only warmer and processor providers.

Add focused tests under `apps/api/test/dashboard-cache-*.test.ts` and update workflow/import tests that instantiate changed services directly.

### Task 1: Install EventEmitter2 and define the cache contract

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `apps/api/src/config/configuration.ts`
- Modify: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache.constants.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache.types.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache-key.ts`
- Test: `apps/api/test/dashboard-cache-key.test.ts`

- [ ] **Step 1: Install the event package**

Run:

```powershell
npm install @nestjs/event-emitter --workspace @supernova/api
```

Expected: `apps/api/package.json` and `package-lock.json` include `@nestjs/event-emitter`.

- [ ] **Step 2: Write the failing canonical-key tests**

Create tests that assert:

```ts
assert.equal(
  dashboardPerformanceCacheKey(UserRole.PICKER, "picker-1", "2026-06"),
  "perf_summary:picker:picker-1:2026-06"
);
assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-06-01", dateTo: "2026-06-20" },
    new Date("2026-06-20T12:00:00.000Z")
  ),
  "2026-06"
);
assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-06-01", dateTo: "2026-06-19" },
    new Date("2026-06-20T12:00:00.000Z")
  ),
  null
);
assert.equal(
  canonicalPerformanceMonth(
    { dateFrom: "2026-05-01", dateTo: "2026-05-31", vendorId: "vendor-1" },
    new Date("2026-06-20T12:00:00.000Z")
  ),
  null
);
```

- [ ] **Step 3: Run RED**

Run:

```powershell
node_modules\.bin\tsx.cmd apps/api/test/dashboard-cache-key.test.ts
```

Expected: FAIL because the dashboard-cache key module does not exist.

- [ ] **Step 4: Implement the key and payload contract**

Define:

```ts
export const DASHBOARD_CACHE_QUEUE = "dashboard-cache";
export const DASHBOARD_CACHE_BULK_JOB = "dashboard-cache.bulk";
export const DASHBOARD_CACHE_TARGETED_JOB = "dashboard-cache.targeted";
export const IMPORT_ATTENDANCE_SUCCESS_EVENT = "import.attendance.success";
export const IMPORT_KPI_SUCCESS_EVENT = "import.kpi.success";
export const USER_METRICS_UPDATED_EVENT = "user.metrics.updated";
export const DASHBOARD_CACHE_TTL_SECONDS = 900;
export const DASHBOARD_CACHE_BULK_CHUNK_SIZE = 100;
export const DASHBOARD_CACHE_CALCULATION_CONCURRENCY = 5;
```

Use event payloads with `eventId`, affected month(s), source, and targeted `userId`. Implement `dashboardPerformanceCacheKey`, `canonicalPerformanceMonth`, and `canonicalMonthRange`. Reject invalid, future, cross-month, filtered, partial historical, and non-current MTD ranges.

Add optional positive-integer configuration for:

```text
DASHBOARD_CACHE_TTL_SECONDS=900
DASHBOARD_CACHE_BULK_CHUNK_SIZE=100
DASHBOARD_CACHE_CALCULATION_CONCURRENCY=5
```

- [ ] **Step 5: Run GREEN**

Run the key test and `npm run typecheck --workspace @supernova/api`.

Expected: PASS.

### Task 2: Add resilient Redis storage and canonical read-through

**Files:**
- Create: `apps/api/src/dashboard-cache/dashboard-cache-store.service.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache-read-through.service.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache.module.ts`
- Test: `apps/api/test/dashboard-cache-read-through.test.ts`

- [ ] **Step 1: Write RED tests for hit, miss, bypass, invalid JSON, and Redis failure**

Use a fake ioredis client and assert:

```ts
assert.deepEqual(await service.getOrCalculate(canonicalInput), cachedSummary);
assert.equal(calculateCalls, 0);

assert.deepEqual(await service.getOrCalculate(cacheMissInput), calculatedSummary);
assert.equal(calculateCalls, 1);
assert.equal(pipelineSetCalls, 1);

assert.deepEqual(await service.getOrCalculate(customRangeInput), calculatedSummary);
assert.equal(redisGetCalls, 0);

assert.deepEqual(await service.getOrCalculate(redisFailureInput), calculatedSummary);
assert.equal(calculateCalls, 1);
```

Malformed JSON must trigger exact-key deletion and calculation.

- [ ] **Step 2: Run RED**

Run:

```powershell
node_modules\.bin\tsx.cmd apps/api/test/dashboard-cache-read-through.test.ts
```

Expected: FAIL because store/read-through services do not exist.

- [ ] **Step 3: Implement Redis storage**

Register a dedicated lazy ioredis client using the existing `REDIS_URL`. Implement:

```ts
get<T>(role: UserRole, userId: string, month: string): Promise<T | null>
delete(role: UserRole, userId: string, month: string): Promise<boolean>
writeMany(entries: DashboardCacheWriteEntry[]): Promise<boolean>
```

`writeMany` must issue `SET key json EX ttl` through one pipeline. All Redis exceptions are logged and converted to `null`/`false`. Invalid JSON is deleted and treated as a miss. Disconnect the dedicated client during module shutdown.

- [ ] **Step 4: Implement canonical read-through**

Expose:

```ts
getOrCalculate<T>({
  role,
  userId,
  query,
  calculate,
  now
}: DashboardCacheReadThroughInput<T>): Promise<T>
```

Non-canonical requests call `calculate` directly. Canonical requests read Redis, calculate on miss/failure, then attempt a single-entry pipeline write without changing the HTTP result on write failure.

- [ ] **Step 5: Run GREEN**

Run both dashboard-cache tests and API typecheck.

Expected: PASS.

### Task 3: Add event listeners and deterministic queue dispatch

**Files:**
- Create: `apps/api/src/dashboard-cache/dashboard-cache-queue.service.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache-events.listener.ts`
- Modify: `apps/api/src/dashboard-cache/dashboard-cache.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/dashboard-cache-events.test.ts`

- [ ] **Step 1: Write RED event/queue tests**

Assert that:

```ts
await listener.onUserMetricsUpdated({
  eventId: "request-1",
  userId: "picker-1",
  month: "2026-06",
  source: "DEDUCTION"
});
assert.deepEqual(deletedKeys, ["perf_summary:picker:picker-1:2026-06"]);
assert.equal(findManyCalls, 0);
assert.equal(queueAdds[0].options.jobId, "targeted-deduction-request-1");

await listener.onAttendanceImportSuccess({
  eventId: "attendance-batch-1",
  months: ["2026-06"],
  source: "ATTENDANCE_IMPORT"
});
assert.equal(queueAdds[1].options.jobId, "bulk-attendance-import-attendance-batch-1");
```

The targeted listener may perform one `user.findUnique` to resolve role/status but must never call `user.findMany`.

- [ ] **Step 2: Run RED**

Run the events test; expect missing listener/queue failures.

- [ ] **Step 3: Implement EventEmitter2 and queue dispatch**

Add `EventEmitterModule.forRoot()` to `AppModule`. Register the dedicated Bull queue in `DashboardCacheModule`. Implement deterministic job IDs from source plus domain `eventId`, bounded retries, exponential backoff, and retained failed jobs.

Implement `@OnEvent` listeners with asynchronous suppressed errors. For targeted events: resolve the one active user, delete the exact role/user/month key, then enqueue the targeted job. Bulk events enqueue without Redis scans or user enumeration.

- [ ] **Step 4: Run GREEN**

Run event tests and typecheck; expect PASS.

### Task 4: Add targeted and chunked bulk worker warming

**Files:**
- Create: `apps/api/src/dashboard-cache/dashboard-cache-warmer.service.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache.processor.ts`
- Create: `apps/api/src/dashboard-cache/dashboard-cache-worker.module.ts`
- Modify: `apps/api/src/worker-app.module.ts`
- Modify: `apps/api/src/workspaces/workspaces.module.ts`
- Test: `apps/api/test/dashboard-cache-warmer.test.ts`
- Test: `apps/api/test/dashboard-cache-processor.test.ts`

- [ ] **Step 1: Write RED targeted-warmer test**

Call `warmTargeted` and assert one `user.findUnique`, zero `user.findMany`, one calculation for the resolved role, and one single-entry pipeline write.

- [ ] **Step 2: Write RED bulk-warmer test**

Provide 205 active fake users. Assert cursor pagination uses three pages at chunk size 100, calculations never exceed configured concurrency, and each page produces one pipeline write containing only successful calculations.

- [ ] **Step 3: Write RED processor-routing test**

Assert the targeted job invokes only `warmTargeted` and the bulk job invokes only `warmBulk`.

- [ ] **Step 4: Run RED**

Run warmer and processor tests; expect missing implementation failures.

- [ ] **Step 5: Implement the worker services**

`warmTargeted` resolves exactly one active user and switches by role:

```ts
PICKER -> WorkspacesService.calculatePickerPerformanceSummary
CHAMP -> WorkspacesService.calculateChampPerformanceSummary
AREA_MANAGER -> AreaManagerPerformanceSummaryService.calculateSummary
```

`warmBulk` cursor-paginates active users, processes each chunk with bounded calculation concurrency, logs per-user failures, and performs one pipeline write per chunk/month. The processor uses strict discriminated job routing; the targeted branch contains no loop.

- [ ] **Step 6: Run GREEN**

Run worker tests and typecheck; expect PASS.

### Task 5: Make workspace reads cache-aware without recursive warming

**Files:**
- Modify: `apps/api/src/workspaces/workspaces.service.ts`
- Modify: `apps/api/src/workspaces/area-manager-performance-summary.service.ts`
- Modify: `apps/api/src/workspaces/workspaces.module.ts`
- Modify: `apps/api/test/picker-performance-summary.test.ts`
- Modify: `apps/api/test/champ-performance-summary.test.ts`
- Modify: `apps/api/test/area-manager-performance-summary.test.ts`
- Test: `apps/api/test/dashboard-cache-workspace-integration.test.ts`

- [ ] **Step 1: Write RED wrapper tests**

Assert each public read method delegates through `DashboardCacheReadThroughService`, while each new calculation method executes Prisma logic directly. Assert scoped Champ/Area Manager requests bypass Redis.

- [ ] **Step 2: Run RED**

Run the workspace integration test; expect missing calculation methods/cache dependency failures.

- [ ] **Step 3: Split public reads from calculations**

Retain controller method names and add:

```ts
calculatePickerPerformanceSummary(userId, query)
calculateChampPerformanceSummary(userId, query)
calculateSummary(areaManagerId, query)
```

Public methods call read-through with a callback to the matching calculation method. Worker warming calls only calculation methods. Update existing test factories with a pass-through cache stub so existing calculation assertions remain unchanged.

- [ ] **Step 4: Run GREEN**

Run picker, Champ, Area Manager, and cache integration tests; expect PASS.

### Task 6: Emit post-commit bulk and targeted domain events

**Files:**
- Modify: `apps/api/src/attendance/attendance-import.service.ts`
- Modify: `apps/api/src/orders-kpis/orders-kpis-import.service.ts`
- Modify: `apps/api/src/deductions/deductions.service.ts`
- Modify: `apps/api/src/approvals/approvals.service.ts`
- Modify: `apps/api/src/requests/requests.service.ts`
- Modify: relevant direct-construction tests under `apps/api/test`
- Test: `apps/api/test/dashboard-cache-domain-events.test.ts`

- [ ] **Step 1: Write RED domain-event tests**

Prove that events are absent on intermediate/rejected paths and emitted once after successful final state changes:

```ts
assert.deepEqual(emittedEvent, {
  name: USER_METRICS_UPDATED_EVENT,
  payload: {
    eventId: requestId,
    userId: targetUserId,
    month: "2026-06",
    source: "DEDUCTION"
  }
});
```

Attendance emits its batch `periodMonth`; KPI confirmation emits unique months derived from covered dates. Annual Leave final approval and cancellation use `annualLeaveRequest.targetUserId` and the start-date month.

- [ ] **Step 2: Run RED**

Run domain-event and existing workflow/import tests; expect event assertions to fail because no events are emitted.

- [ ] **Step 3: Emit only after committed transactions**

Inject `EventEmitter2` into the five mutation services. Store the transaction result, emit synchronously after the transaction promise resolves, and then return the existing response. Do not emit from preview processing, intermediate approvals, rejection, or failed transactions.

- [ ] **Step 4: Run GREEN**

Run domain-event, annual-leave, deductions, attendance import, and Orders KPI confirmation tests; expect PASS.

### Task 7: Verification and handoff

**Files:**
- Modify: `apps/api/package.json` to add a `test:dashboard-cache` script containing all focused test files.
- Review: all changed production and test files.

- [ ] **Step 1: Run focused tests**

```powershell
npm run test:dashboard-cache --workspace @supernova/api
npm run test:imports --workspace @supernova/api
node_modules\.bin\tsx.cmd apps/api/test/deductions-workflow.test.ts
node_modules\.bin\tsx.cmd apps/api/test/annual-leave-approval-finalization.test.ts
node_modules\.bin\tsx.cmd apps/api/test/annual-leave-request-workflow.test.ts
node_modules\.bin\tsx.cmd apps/api/test/picker-performance-summary.test.ts
node_modules\.bin\tsx.cmd apps/api/test/champ-performance-summary.test.ts
node_modules\.bin\tsx.cmd apps/api/test/area-manager-performance-summary.test.ts
```

- [ ] **Step 2: Run repository checks**

```powershell
$env:DIRECT_URL=$env:DATABASE_URL
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0. Report any command that did not run or failed.

- [ ] **Step 3: Review quality guards**

Run `clean-code-guard` on production changes and `test-guard` on test changes. Resolve scoped findings only, rerun affected checks, and confirm no secrets or generated runtime files are staged.

- [ ] **Step 4: Commit implementation**

Stage only the dashboard cache implementation, dependency lock changes, environment example, module wiring, event emitters, and focused tests. Commit with:

```powershell
git commit -m "Add targeted dashboard cache warming"
```
