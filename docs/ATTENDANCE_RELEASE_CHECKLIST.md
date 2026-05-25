# Attendance Release Checklist

Use this checklist before merging or releasing Attendance Analytics.

## Import Checks

- Daily MTD Override derives first day of current month through yesterday.
- Historical Backfill derives first and last day of the selected month.
- XLSX upload rejects missing files, non-`.xlsx` files, invalid periods, and unsupported modes.
- Fatal parser errors fail the batch and do not build records or summaries.
- Uploaded XLSX files are not permanently stored.
- Non-Egypt rows are counted and ignored.
- Duplicate `Identifier + Shift Date` rows create warnings.
- Import result shows counts, warning/error totals, and sample calculated users.

## Historical Backfill Checks

- Preview uses `Location`, not `Shift Location`.
- Location code maps to `Vendor.vendorExternalId`.
- Unmapped or malformed Location values produce warnings and no proposal.
- Conflicting Location evidence produces conflicts and no proposal.
- Preview does not create assignments.
- Confirmation revalidates server-side.
- Confirmation requires `CREATE HISTORICAL ASSIGNMENTS`.
- Confirmation creates CLOSED past `PickerBranchAssignment` rows only.
- Current active assignments are never closed, deleted, replaced, or altered.
- CHAMP rows never create Branch assignments.

## Maintenance Checks

- Maintenance routes are SUPER_ADMIN only.
- Every dangerous operation requires impact preview.
- Confirm buttons are disabled until preview can proceed.
- Delete operations require `DELETE ATTENDANCE DATA`.
- Recalculate requires `RECALCULATE ATTENDANCE SUMMARIES`.
- Compression requires `COMPRESS ATTENDANCE MONTHS`.
- Delete range, delete month, delete all, recalculate, and compress produce final summaries.
- Maintenance operations affect only attendance tables and AuditLog.
- Delete all does not delete AuditLog.
- Current and previous months are not compressed.
- Old month compression verifies monthly summaries before deleting daily records.

## Admin Report Checks

- Admin and Super Admin can access `/admin/reports/attendance`.
- Area Manager, Champ, and Picker cannot access Admin/Super Admin attendance reports.
- Overview separates Picker and Champ counts.
- Branch and Chain totals include Pickers only.
- Champ attendance appears as user-level summaries only.
- Compressed months show the summary-only daily detail message.
- User daily details modal is read-only.

## Area Manager Scoped Report Checks

- Area Manager can access `/area-manager/reports/attendance`.
- Scope is derived from current user id, not a client-provided `areaManagerId`.
- Assigned Chain scope is enforced on overview, chains, branches, users, and daily details.
- Out-of-scope Chain, Branch, or user requests return Forbidden.
- Picker Operations and Champ Attendance remain separate.
- Branch and Chain totals are Picker-only.

## Champ Scoped Report Checks

- Champ can access `/champ/reports/attendance`.
- Scope is derived from current user id, not a client-provided `champId`.
- Assigned Branch scope is enforced on overview, branches, users, and daily details.
- Champ cannot see another Champ's attendance.
- Champ cannot see Pickers outside assigned Branches.
- Champ page does not show a Chain summary when no Chain summary exists.

## Access-Control Checks

- `/api/attendance-operations/*` uses JWT guard, roles guard, and SUPER_ADMIN role.
- `/api/attendance-operations/maintenance/*` is SUPER_ADMIN only.
- `/api/reports/attendance/months` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/overview` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/chains` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/branches` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/users` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/users/:userId/daily` is ADMIN/SUPER_ADMIN only.
- `/api/reports/attendance/area-manager/*` is AREA_MANAGER only.
- `/api/reports/attendance/champ/*` is CHAMP only.

## Mobile UI Checks

- Verify 360px, 390px, and 430px widths.
- No horizontal page overflow.
- Upload file selector remains usable by touch.
- Import History details modal is scrollable on mobile.
- Data Maintenance confirmation dialog is readable on mobile.
- Report filters stack cleanly.
- Tables become cards or controlled horizontal scroll.

## Build and Test Commands

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-calculation.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-parser.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-matcher.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-assignment-snapshot.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-summary.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-import.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-location-mapper.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-historical-assignment-backfill.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-operations.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-operations.controller.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-reports.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/attendance-scoped-reports.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/reports-access-policy.test.ts
npx tsx --tsconfig apps/web/tsconfig.json apps/web/components/reports/attendance-report-page.test.ts
git diff --check
```

## Manual QA Still Required

- Run one small Daily MTD import against safe local data.
- Run one Historical Backfill import against safe local data.
- Run Historical Assignment Backfill preview with mapped, unmapped, and conflicting Locations.
- Confirm one safe historical assignment backfill in local data only.
- Preview each maintenance operation and confirm one non-destructive recalculation locally.
- Verify Admin, Super Admin, Area Manager, and Champ report pages using realistic roles.
- Verify production backup/restore procedure before any delete-all operation.
