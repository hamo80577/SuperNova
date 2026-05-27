# Phase 8B — Attendance Role-Scoped Report UI Routes

Start only after Phase 8A is merged into `main`.

If Phase 8A is not merged into `main`, stop and report that Phase 8B is blocked.

## Required Branch Workflow

Start from latest `main` and create a new implementation branch:

```bash
git checkout main
git pull
git checkout -b feature/attendance-role-scoped-report-ui
```

Do not implement directly on `main`.

## Product Context

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Attendance current state after Phase 8A:

- `GET /attendance/reports/daily` is role-aware.
- Admin/Super Admin see all active attendance batch data.
- Area Manager sees only scoped picker rows from current active assignments.
- Champ sees only scoped picker rows from current active assignments.
- Picker API support exists but Picker UI is not part of Phase 8B.
- Imported `sourceLocation` and `sourceSubDivision` are read-only reporting labels only.
- Authorization and report scope come from assignment tables, not imported source labels.

## Phase 8B Goal

Add role-scoped Attendance report UI routes for Area Manager and Champ using the existing large Attendance dashboard component.

This phase is frontend UI routing/composition only, with minimal API/client changes only if required.

## Routes To Add

Add:

```text
/area-manager/reports/attendance
/champ/reports/attendance
```

Both routes should use the existing large Attendance dashboard UI.

Do not create separate duplicated dashboard implementations.

Use a shared component or props-based wrapper so future dashboard changes apply to Admin, Area Manager, and Champ together.

## Existing Admin Route

Keep the existing Admin route:

```text
/admin/reports/attendance
```

Admin/Super Admin should keep the Import button/link.

## Role Behavior

### Admin / Super Admin

Existing behavior stays:

- Large dashboard.
- Source chain/source branch filters.
- Import shortcut visible.
- Full active batch data from backend.

### Area Manager

Route:

```text
/area-manager/reports/attendance
```

Allowed role:

```text
AREA_MANAGER
```

Behavior:

- Same large dashboard layout.
- No Import button/link.
- Read-only report.
- Copy should clearly say the report is scoped to the Area Manager's current operational assignments.
- Source chain/source branch filters are still imported source labels and only filter within the backend-scoped data.

### Champ

Route:

```text
/champ/reports/attendance
```

Allowed role:

```text
CHAMP
```

Behavior:

- Same large dashboard layout.
- No Import button/link.
- Read-only report.
- Copy should clearly say the report is scoped to the Champ's current assigned branches/pickers.
- Source chain/source branch filters are still imported source labels and only filter within the backend-scoped data.

## Navigation

Update role navigation carefully:

- Add Attendance link under Reports for Area Manager.
- Add Attendance link under Reports for Champ.
- Do not remove existing Reports links unless the current UX clearly requires a nested page relationship.
- Keep Admin/Super Admin navigation unchanged except for any small consistency label fix if needed.

Suggested labels:

```text
Attendance
```

## Component Direction

Before editing, inspect:

- `apps/web/app/admin/reports/attendance/page.tsx`
- `apps/web/components/reports/attendance-daily-report-page.tsx`
- `apps/web/components/dashboard/role-nav.ts`
- `apps/web/components/dashboard/dashboard-shell` or current dashboard frame implementation
- `apps/web/lib/api/attendance.ts`

Preferred implementation:

1. Refactor `AttendanceDailyReportPage` only as much as needed to accept a small variant/config prop.
2. Avoid duplicated dashboard code.
3. Example config shape is acceptable:

```ts
type AttendanceReportWorkspaceVariant = "admin" | "area-manager" | "champ";
```

4. Hide the import shortcut unless variant is `admin`.
5. Adjust page title/description/copy through props or a small config map.
6. Keep the same API call. The backend already scopes by the authenticated user's role.

## UI/UX Requirements

- Mobile-first: 360px-430px must not horizontally overflow.
- Keep the large dashboard; do not simplify it.
- Keep clean cards, filters, badges, tables, and mobile cards.
- No fake data.
- No random SaaS clutter.
- Do not add charts beyond the existing dashboard.
- Do not add payroll, deductions, penalties, GPS, order integration, POS, inventory, or generic ERP features.

## Security Requirements

- Do not trust frontend routes for security. Backend Phase 8A remains source of truth.
- Do not add query params that can widen scope.
- Do not use `sourceLocation` or `sourceSubDivision` for authorization.
- Do not expose import/confirm controls to Area Manager or Champ.
- Do not add upload routes for Area Manager or Champ.
- Do not add Picker UI in Phase 8B.

## Explicit Non-Goals

Do not implement:

- Picker self attendance page.
- Date-effective historical assignment scoping.
- CSV support.
- Import changes.
- Confirm changes.
- Attendance calculation changes.
- Prisma schema changes.
- Backend role-scope changes unless a small type mismatch requires it.
- Assignment mutation behavior.

## Tests / Checks

Add or update frontend/API tests where useful. At minimum run:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Run existing Attendance tests if affected:

```bash
npx --no-install tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-admin-daily-report.test.ts
npx --no-install tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-role-scoped-report.test.ts
npx --no-install tsx --tsconfig apps/web/tsconfig.json apps/web/lib/api/attendance.test.ts
```

If tests fail because Phase 8A is not present on `main`, stop and report the branch/base issue.

## Manual Verification

Verify locally:

- Admin opens `/admin/reports/attendance` and still sees Import shortcut.
- Area Manager opens `/area-manager/reports/attendance` and sees the large dashboard without Import shortcut.
- Champ opens `/champ/reports/attendance` and sees the large dashboard without Import shortcut.
- Area Manager and Champ reports load through the same API and receive backend-scoped data.
- Source chain/source branch filters work inside the allowed scope.
- 390px viewport has no horizontal overflow.

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
