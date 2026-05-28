# Phase 8C — Picker Self Attendance Page Planning Prompt

You are working on SuperNova.

## Branch Rule

Start from latest `main` and use one feature branch only for this workstream:

```bash
git checkout main
git pull
git checkout -b feature/picker-self-attendance-page
```

Do not create a child branch from another feature branch.

## Mode

Planning only.

Do not edit implementation code yet.
Do not create the page yet.
Do not modify API, Prisma, parser, import, calculation, reports, navigation, or shared UI yet.

First inspect the repo, then return a detailed implementation plan for approval.

## Product Goal

Build a mobile-first Picker self-attendance experience.

Most Pickers will use this from a phone, so the target viewport is 360px–430px with no horizontal overflow.

The page should motivate the Picker to improve attendance behavior and keep their Shift Score above 90%.

## Proposed Route

```text
/picker/attendance
```

This route is for `PICKER` only.

## Data Source

Use the existing Attendance Daily Report API if suitable:

```text
GET /attendance/reports/daily
```

Backend Phase 8A already scopes `PICKER` users to their own attendance rows.

Do not add a new API unless inspection proves the current API is too heavy or missing critical fields.

If a new lightweight endpoint is recommended, propose it only in the plan. Do not implement it yet.

## Core UX Direction

This is not the Admin dashboard.
This is not a table-first report.
This is a Picker mobile app-style self-performance page.

The page should feel:

```text
clean
motivational
mobile-first
fast
touch-friendly
clear
operational
```

## Main Metric — Shift Score

Show a strong visual Shift Score module near the top.

Definition:

```text
Shift Score = Clean Shifts / Total Shifts
```

The product target is to motivate the Picker to stay above 90%.

Plan a visually strong score presentation:

```text
large score percentage
progress ring/bar
encouraging status copy
above/below 90% target indicator
clean shift count vs total shift count
```

## Clean Shift Definition

For planning, define Clean Shift as a shift without error tags.

A shift is not clean if it has any of:

```text
Late 1
Late 2
Late 3
Absent
Under 8
Over 15
```

If the current API field mapping has a better source of truth, call it out in the plan.

## Error Buckets

Error shifts should appear in a proper UX bucket, not as a scary generic error.

Show clear segmentation for:

```text
Late 1
Late 2
Late 3
Absent
Under 8
Over 15
```

Late bucket copy must be user-friendly.
Do not show internal concepts like `grace` or `chargeable late`.

Example:

```text
Your shift started at 9:00. You checked in at 9:28, so this shift is Late 1 because you checked in 28 minutes late.
```

Do not write:

```text
grace mins
chargeable late mins
```

## Shift History Tabs

Below the score and summary, show Shift History.

Tabs/segments:

```text
All
Clean Shift
Error Shift
Late
Absent
Under 8
Over 15
```

Default selected tab:

```text
Error Shift
```

The goal is to immediately show the Picker what needs improvement.

## Shift Cards

Shift history must be card-based, not a desktop table.

Each card should show:

```text
Shift name as main card header
Status tags
Date
Source location / branch label from attendance file
Source chain / subdivision label from attendance file if useful
Scheduled shift time
Actual check-in / check-out
Work time
```

Status tags can include:

```text
Clean
Late 1
Late 2
Late 3
Absent
Under 8
Over 15
```

Tags should be visually distinct and creative, but still professional and readable.

## Shift Detail Bottom Sheet / Dialog

When tapping a shift card, open a clean mobile-friendly detail screen.

Prefer a bottom sheet style on mobile if existing components support it; otherwise use a responsive dialog.

Details should show:

```text
Shift name
Date
Source branch/location
Source chain/subdivision
Scheduled start/end
Actual check-in/out
Work time
Status tags
Late explanation if late
Absent explanation if absent
Under/Over hours explanation if relevant
```

Use friendly operational wording.

## Out of Scope

Do not add:

```text
payroll
salary deductions
penalties
GPS
live punch-in/out
biometric attendance
manual attendance editing
assignment changes
lifecycle changes
CSV support
new import behavior
Admin/Champ/Area Manager dashboard changes
```

The page is read-only self-attendance visibility.

## Required Repo Inspection

Before proposing the plan, inspect:

```text
apps/web/app/picker
apps/web/components/workspaces
apps/web/components/reports/attendance-daily-report-page.tsx
apps/web/lib/api/attendance.ts
apps/web/components/dashboard/role-nav.ts
apps/api/src/attendance/attendance-report.types.ts
apps/api/src/attendance/attendance-report.service.ts
apps/api/src/attendance/attendance-reports.controller.ts
prisma/schema.prisma
```

Also inspect any existing Picker workspace/page patterns so the new page fits the product.

## Planning Output Required

Return a plan only, with:

```text
Summary
Current Repo Findings
Product Problem
Recommended UX Structure
Data Mapping
Route Plan
Component Plan
API Fit / API Gap Assessment
Implementation Phases
Out of Scope
Risks
Questions / Decisions Needed
Recommended Next Step
```

## Checks

No checks are required for this planning-only step because no code should be changed.

If you accidentally make changes, stop and report them.
