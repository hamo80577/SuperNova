# Admin Performance Dashboard Backend Design

**Status:** Approved design; implementation follows this document.

## Goal

Add a read-only Admin/Super Admin performance summary endpoint without changing existing role dashboards, workflows, assignments, or the Admin UI.

## Endpoint Contract

```http
GET /workspaces/admin/performance-summary?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&chainId=optional&vendorId=optional
```

Only `ADMIN` and `SUPER_ADMIN` may call the endpoint. The response provides the selected period and filters, available selectors, scope totals, Orders KPI, attendance health, ticket metrics, Area Manager/Champ/branch rankings, and the Top 10 Pickers.

The implementation uses a dedicated `AdminPerformanceSummaryService`. Existing Picker, Champ, and Area Manager summary services remain unchanged.

## Filters and Scope

- `dateFrom` and `dateTo` are required valid calendar dates and `dateFrom` must not be after `dateTo`.
- `chainId` and `vendorId` are optional.
- A supplied chain or vendor must exist.
- When both are supplied, the vendor must belong to the selected chain.
- Operational scope is derived from the assignment tables, not hierarchy fields on `User`.
- Selectors and all returned aggregates respect the selected chain/vendor scope.

## Orders KPI and Targets

- Only daily KPI records whose source batch has status `CONFIRMED` are included.
- Targets are read from the existing target settings/evaluation services; values are not hardcoded in this endpoint.
- The filtered/custom summary is calculated directly and is not stored in the canonical monthly dashboard cache.

## Attendance Health

- Attendance includes both Pickers and Champs in the selected scope.
- Attendance health is the clean-shift rate: `clean shifts / total shifts`.
- It is not presence rate. A shift with any tracked attendance issue is not clean.

## Ticket Summary Semantics

- `totalTickets`: requests created inside the selected period and selected scope. This does not mean all historical tickets.
- `openedInPeriod`: requests created inside the selected period and selected scope.
- `closedInPeriod`: requests currently `APPROVED` or `COMPLETED` whose reliable `completedAt` is inside the selected period.
- `rejectedOrCancelled`: requests created inside the selected period and currently `REJECTED` or `CANCELLED`.
- `openNow`: currently open/pending requests in the selected scope, regardless of creation date.
- `waitingMyAction`: requests currently waiting for Admin/Super Admin final action, regardless of the selected period.

`updatedAt` is never treated as a close date for rejected or cancelled requests. The service may use `createdInPeriod` as an internal name while preserving `totalTickets` in the public contract.

## Rankings

- Area Manager, Champ, and branch rankings are computed by the backend.
- Valid KPI rows are ordered by UHO ascending; lower is better.
- Name ascending is used only as a stable tie-breaker when UHO values are equal.
- Rows without valid KPI are marked `NO_KPI` and never rank above rows with an actual UHO.
- Supported performance statuses are `NO_KPI`, `LOW_VOLUME`, `NEEDS_ACTION`, `WATCH`, and `IN_TARGET`.

## Top 10 Pickers

Top Pickers are ordered by UHO percentage after applying the minimum confirmed-order requirement for the inclusive date range:

| Range length | Minimum confirmed orders |
| --- | ---: |
| 1 day | 5 |
| 2–7 days | 20 |
| 8–31 days | 60 |
| More than 31 days | 180 |

At most 10 eligible Pickers are returned. Low-volume Pickers cannot appear as top performers.

## Out of Scope

- Picker, Champ, and Area Manager dashboard behavior
- Admin/Super Admin UI redesign
- Lifecycle workflows and request approval rules
- Assignment mutation behavior
- Deduction visibility policy and payroll/salary logic
- GPS, biometric attendance, POS, inventory, or accounting
- Prisma schema changes, generic report engines, microservices, or filtered dashboard caching
