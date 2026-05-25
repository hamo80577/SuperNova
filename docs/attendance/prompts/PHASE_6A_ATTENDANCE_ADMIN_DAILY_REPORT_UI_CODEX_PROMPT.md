# Codex Prompt — Phase 6A Attendance Admin Daily Report UI

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
```

Approved spec:

```text
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
```

Backend daily report API:

```text
GET /attendance/reports/daily
```

This phase is UI only for the Admin/Super Admin Daily Attendance Report page.

## Goal

Implement Phase 6A only: Admin/Super Admin Daily Attendance Report UI.

The UI must consume the Phase 5 backend API and display the stored ACTIVE-batch attendance records.

Do not implement the upload/import console in this phase. That will be Phase 6B.

## Product Rules To Preserve

```text
Reports read only ACTIVE attendance batches.
Identifier = shopperId.
Role comes from SuperNova, not Excel Designation.
Only Picker-level attendance is shown in v1.
Grace period and late buckets are already calculated by backend.
Frontend must display backend-calculated values; do not recalculate attendance in the UI.
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
No upload/import UI
No confirm/replace UI
No parser in frontend
No attendance calculation in frontend
No backend changes unless fixing a tiny API-client contract issue
No Prisma/schema changes
No report write/mutation actions
No Picker self-view
No Champ/Area Manager scoped attendance pages yet
No Branch/Chain analytics
No payroll/deductions
No assignment/lifecycle mutation
No fake dashboard clutter
```

## Required Repo Inspection Before Editing

Inspect these files/directories first:

```text
AGENTS.md
README.md
docs/PLANNING_RESET.md
docs/attendance/ATTENDANCE_ENGINE_SPEC.md
apps/api/src/attendance/attendance-report.types.ts
apps/api/src/attendance/attendance-reports.controller.ts
apps/web
apps/web/components
apps/web/lib/api
apps/web/app
existing admin reports pages/components
existing role navigation/sidebar files
```

Before edits, provide a short plan.

## Scope Allowed

Allowed:

```text
Add frontend API client for GET /attendance/reports/daily
Add Admin/Super Admin attendance daily report page
Add page component(s) for filters, summary cards, daily table, row detail drawer if scoped
Add route/nav item only for Admin/Super Admin if consistent with existing nav patterns
Add small shared formatting helpers if needed
```

Not allowed:

```text
No backend report logic changes unless unavoidable
No import console UI
No upload file control
No preview/confirm buttons
No frontend parsing
No new package dependency
No broad UI refactor
No unrelated page redesign
```

## Suggested Route

Choose the route that best matches existing repo conventions.

Preferred candidate:

```text
/admin/reports/attendance
```

If the app uses a different reports routing convention, follow the existing convention and explain it in the final response.

## UI Requirements

Design the page as an operational report, not a fake SaaS dashboard.

Mobile-first for 360px–430px.

No horizontal overflow on mobile.

Use clean cards, filters, badges, tables/cards, and clear operational copy.

Desktop may use a table.

Mobile should switch to compact row cards if the existing table would overflow.

## Required Filters

Use the backend query params:

```text
periodMonth required
dateFrom optional
dateTo optional
shopperId optional
pickerSearch optional
status optional
lateOnly optional
absentOnly optional
onLeaveOnly optional
page optional
pageSize optional
```

UI filter behavior:

```text
periodMonth input/select is required
search by Picker name or Shopper ID
quick filters: Late only, Absent only, On Leave only
status select using calculated statuses
clear filters action
pagination controls
```

Do not add Branch/Chain filters in Phase 6A.

## Required Data Display

Show coverage/import metadata:

```text
periodMonth
activeBatchId
coverageStartDate
coverageEndDate
expectedCoverageEndDate
```

Show summary cards:

```text
totalRows
onTimeCount
lateCount
absentCount
leaveCount
offDayCount
under8HoursCount
over15HoursCount
totalChargeableLateMins
```

Show daily rows with these visible columns/fields:

```text
Picker
Shopper ID
Date
Shift
Scheduled Start
Scheduled End
Check-in
Check-out
Work Hours
Status
Raw Late
Chargeable Late
Late Bucket
Leave Type
Location
Issues
```

Row detail drawer/card may show:

```text
User ID
Source Designation
isWorkingDay
Under 8 / Over 15 flags
issuesCount
```

## Status/Badge UX

Use clear badges:

```text
ON_TIME = positive/neutral
LATE = warning
ABSENT = destructive/high attention
ANNUAL_LEAVE / MEDICAL_LEAVE / OTHER_LEAVE = secondary/info
OFF_DAY = muted
```

Use labels that normal operations users understand.

Do not expose enum names only if the UI already has a label helper pattern.

## Empty/Error/Loading States

Handle:

```text
Loading
No active batch for selected month
No rows match filters
API error
Unauthorized/forbidden if surfaced by existing API client pattern
```

If no active batch exists, use copy like:

```text
No confirmed attendance batch found for this month.
```

## Tests / Checks

Add or update tests only if the repo has existing frontend test conventions. If not, do not invent a heavy test setup.

At minimum run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Also run attendance backend tests if touched indirectly:

```powershell
npx --no-install tsx apps/api/test/attendance-admin-daily-report.test.ts
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
