# Codex Prompt — Phase 6B Attendance Import Console UI

You are working in the SuperNova repository.

## Context

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Current branch:

```text
feature/attendance-analytics-clean-v2
```

Completed phases:

```text
Phase 0 — Attendance Engine specification
Phase 1 — Prisma data model foundation
Phase 2 — Backend Excel parser + validator preview
Phase 3 — Backend in-memory calculation engine
Phase 4 — Backend import storage + confirm/replace workflow
Phase 5 — Admin/Super Admin read-only Daily Report API
Phase 6A — Admin/Super Admin Daily Report UI
```

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Existing backend import endpoints:

```text
POST /attendance/imports/preview
POST /attendance/imports/:batchId/confirm
```

Existing report UI route:

```text
/admin/reports/attendance
```

## Goal

Implement Phase 6B only: Admin/Super Admin Attendance Import Console UI.

The UI must allow Admin/Super Admin to upload an MTD Excel file, receive backend validation preview, inspect counts/issues/coverage, and confirm a valid batch.

The frontend must not parse Excel or calculate attendance.

## Product Rules To Preserve

```text
MTD = month start through yesterday only
Upload/preview does not activate the batch
Confirm activates the batch and replaces previous ACTIVE batch for same periodMonth
Reports read ACTIVE batches only
Identifier = shopperId
Role comes from SuperNova, not Excel Designation
Only Picker-level attendance is v1
```

Working-day definition:

```text
isWorkingDay = true only for ON_TIME or LATE
totalWorkingDays = ON_TIME + LATE only
ABSENT does not count as a working day
absentCount is separate
```

## Hard Guardrails

Do not implement:

```text
No frontend Excel parsing
No frontend attendance calculation
No backend parser/calculation/report changes unless fixing a tiny API contract issue
No Prisma/schema changes
No Picker self-view
No Champ/Area Manager attendance pages
No Branch/Chain analytics
No payroll/deductions
No assignment/lifecycle mutation
No fake dashboard clutter
No new package dependency
```

## Required Repo Inspection Before Editing

Inspect these files/directories first:

```text
AGENTS.md
README.md
docs/PLANNING_RESET.md
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
apps/api/src/attendance/attendance-import.types.ts
apps/api/src/attendance/attendance-imports.controller.ts
apps/web/app/admin/reports/attendance/page.tsx
apps/web/components/reports/attendance-daily-report-page.tsx
apps/web/lib/api/attendance.ts
apps/web/lib/api/request.ts
apps/web/components/dashboard/role-nav.ts
apps/web/components/reports/report-pages.tsx
apps/web/components/ui
```

Also inspect existing file upload/API-client patterns if any.

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Extend frontend attendance API client for import preview + confirm
Add Admin/Super Admin import console page
Add route/nav link for Admin/Super Admin
Add upload form using multipart FormData
Add preview result cards/table
Add issues list/table
Add confirm button gated by canConfirm
Add clear/reset action
Add link back to Daily Attendance Report
```

Not allowed:

```text
No report API changes
No Daily Report UI redesign except optional link to Import Console
No backend changes unless needed for typed response compatibility
No Excel parsing in frontend
No seed data
No broad refactor
No unrelated cleanup
```

## Suggested Route

Preferred route:

```text
/admin/attendance/imports
```

Alternative acceptable if existing app conventions strongly prefer:

```text
/admin/reports/attendance/imports
```

Explain route choice in final response.

## API Client Requirements

Add frontend client methods for:

```text
attendanceApi.previewImport(file, options)
attendanceApi.confirmImport(batchId)
```

Preview endpoint behavior:

```text
POST /attendance/imports/preview
multipart field name: file
optional uploadDate if UI provides it
```

Confirm endpoint behavior:

```text
POST /attendance/imports/:batchId/confirm
```

Use existing API request helpers/patterns. If the helper does not support FormData, add the smallest safe extension.

Do not expose credentials/tokens manually outside existing request/auth pattern.

## UI Requirements

Design as an operational console, not a dashboard.

Mobile-first for 360px–430px.

No horizontal overflow.

Desktop may show tables; mobile should use cards/lists.

Required sections:

```text
Header: Attendance Import Console
Short explanation: Upload MTD Excel from month start through yesterday
Upload card: file input, upload date optional/default today, Preview button
Preview status card: batchId, status, canConfirm
Coverage card: periodMonth, coverageStartDate, coverageEndDate, expectedCoverageEndDate
Counts cards: rowCount, egyptRows, nonEgyptRows/excludedNonEgyptRows, matchedPickerRows, unmatchedRows, excludedNonPickerRows, errorRows, warningRows, dailyRecordCount, monthlySummaryCount, issueCount
Issues section: severity, issueCode, rowNumber, shopperId, fieldName, message
Confirm section: only enabled when canConfirm is true
Result state after confirm: activated batch id, status, previousActiveBatchId, confirmedAt
```

Use clear copy:

```text
Preview only — this does not activate the batch.
Confirm will replace the current active batch for this month.
```

Confirm should require a deliberate user action. Minimum:

```text
Disable Confirm unless canConfirm is true and batchId exists.
Show clear warning text before Confirm.
```

Better if simple and scoped:

```text
Require checking a confirmation checkbox before enabling Confirm.
```

Do not add complex modal frameworks unless existing UI has a pattern.

## Error / Loading / Empty States

Handle:

```text
No file selected
Uploading/previewing
Preview failed
Validation errors returned by backend
Confirming
Confirm failed
Confirmed successfully
Unauthorized/forbidden if surfaced by existing API client pattern
```

## Navigation

Admin/Super Admin should be able to reach the page.

Add nav item only for:

```text
ADMIN
SUPER_ADMIN
```

Suggested label:

```text
Attendance Imports
```

Do not expose to Picker/Champ/Area Manager.

Optionally add a link from Daily Report UI to Import Console for Admin/Super Admin, if clean and small.

## Tests / Checks

Add/update frontend API client tests for request path/FormData behavior if existing test style allows.

Do not invent a heavy browser/e2e framework.

At minimum run:

```powershell
npm run typecheck
npm run lint
npm run build
```

If API client tests are added, run them.

Also run existing attendance UI/API test touched by this phase if relevant:

```powershell
npx --no-install tsx --tsconfig apps/web/tsconfig.json apps/web/lib/api/attendance.test.ts
```

Do not claim checks passed unless they actually ran.

## Final Response Format

Respond with:

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

Completion Status should be one of:

```text
Complete
Complete with known risks
Blocked
Partially complete
Rejected / needs correction
```
