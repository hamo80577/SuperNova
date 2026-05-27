# Phase 8A — Attendance Role-Scoped Report API

Start from the latest `main` and create a new implementation branch:

```bash
git checkout main
git pull
git checkout -b feature/attendance-role-scoped-reports
```

Do not implement directly on `main`.

## Goal

Make the existing Attendance Daily Report API role-aware and scoped by the authenticated user.

Existing endpoint:

```text
GET /attendance/reports/daily
```

This phase is backend/API only. Do not create new UI routes in this phase.

## Current Product Decisions

- Keep the large Attendance dashboard response shape compatible with the current UI.
- Imported attendance source labels remain report filters only:
  - `sourceLocation`
  - `sourceSubDivision`
- Do not use source labels for permission scope.
- Scope must come from SuperNova assignment tables.

## Roles To Support

Allow the report endpoint for:

```text
ADMIN
SUPER_ADMIN
AREA_MANAGER
CHAMP
PICKER
```

Import and confirm endpoints must remain Admin/Super Admin only.

## Scope Rules

### Admin / Super Admin

See all rows from the active attendance batch for the selected period month.

### Area Manager

See only attendance rows for Pickers currently assigned to Vendors under Chains currently assigned to the Area Manager.

Use current active assignments:

```text
ChainAreaManagerAssignment.areaManagerId = currentUser.id
Vendor.chainId in assigned chainIds
PickerBranchAssignment.vendorId in scoped vendorIds
AttendanceDailyRecord.userId in scoped pickerIds
```

### Champ

See only attendance rows for Pickers currently assigned to Vendors currently assigned to the Champ.

Use current active assignments:

```text
VendorChampAssignment.champId = currentUser.id
PickerBranchAssignment.vendorId in assigned vendorIds
AttendanceDailyRecord.userId in scoped pickerIds
```

### Picker

See only their own rows:

```text
AttendanceDailyRecord.userId = currentUser.id
```

## Phase 8A Scope Decision

Use current active assignment scope only.

Do not implement historical/date-effective assignment scoping yet.

Document this known limitation:

```text
If a Picker was transferred mid-month, Phase 8A scopes by current active assignment, not assignment effective on shiftDate.
```

## Required Behavior

- Rows must be scoped.
- Analytics must be scoped.
- Summary must be scoped.
- Pagination totalRows must be scoped.
- Filter options must be scoped.
- Query filters must not widen scope.
- Source label filters may still filter inside the allowed scope:
  - `branch` filters `sourceLocation`.
  - `chain` filters `sourceSubDivision`.
- No attendance report action should mutate users, roles, assignments, or account lifecycle fields.

## Implementation Requirements

Before edits:

1. Inspect the Attendance module.
2. Inspect assignment models and existing scoping patterns.
3. Write a short implementation plan before editing.

Suggested approach:

1. Update `AttendanceReportsController` to allow all five roles and pass `CurrentUser` into the service.
2. Update `AttendanceReportService` to apply a role-based scoped `userId` condition to all AttendanceDailyRecord queries.
3. Add a small private helper/service if needed for resolving scoped picker IDs.
4. Keep the report response shape compatible with the existing frontend.
5. Do not change Prisma schema unless absolutely unavoidable.
6. Do not change import, preview, confirm, calculation, or duplicate-resolution logic.

## Tests To Add Or Update

Cover at least:

- Admin sees all active rows.
- Area Manager sees only scoped picker rows.
- Champ sees only scoped picker rows.
- Picker sees only own rows.
- Filter options are scoped.
- Analytics are scoped.
- Pagination totals are scoped.
- Query filters cannot widen scope.
- Non-active batches stay excluded.
- Import/confirm roles remain Admin/Super Admin only.

## Required Checks

Run:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npx --no-install tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-admin-daily-report.test.ts
```

If you add a new test file, run it too, for example:

```bash
npx --no-install tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-role-scoped-report.test.ts
```

## Manual Verification

Verify where possible:

- Admin report still loads all active batch data.
- Area Manager report API returns only scoped Pickers.
- Champ report API returns only scoped Pickers.
- Picker report API returns only own rows.
- Source Chain/Branch filters still work inside the allowed scope.
- Import and confirm remain Admin/Super Admin only.

## Final Response Format

Return:

```text
Summary
Files Changed
Behavior Changes
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommendation
```
