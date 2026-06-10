# Codex Goal — Orders KPI Professional Performance Workspace + Targets

## Goal Name

```text
Orders KPI Professional Performance Workspace + Targets
```

## Goal Summary

Redesign the Orders KPI Report page into a professional KPI performance workspace that supports:

```text
- A polished date-range header
- 8 professional KPI cards with icon, metric name, main value, delta, and trend-ready visual area
- Flexible cascading filters for Chain / Vendor / Picker
- Global search across chain/vendor/picker/shopper/vendor id data
- Tabs for Chain / Vendor / Picker views
- Professional performance tables with sortable headers
- Visual in-target / out-of-target evaluation
- Orders KPI target settings
- No fake metrics
- No Attendance refactor
- No lifecycle/workflow changes
```

This is a **staged Codex Goal**, not a one-shot freeform implementation.

You must plan the full goal first, then execute it stage by stage.

After each stage:
1. Run the relevant checks.
2. Report what changed.
3. Confirm whether it is safe to proceed.
4. Do not continue if checks fail, schema risk appears, or product direction is unclear.

---

## Non-Negotiable SuperNova Guardrails

SuperNova is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Core hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Do not store operational `chainId`, `vendorId`, or `managerId` as source-of-truth fields on `User`.

Do not mutate assignment tables directly.

Do not change lifecycle workflows.

Sensitive lifecycle changes must stay:

```text
Request -> Approval -> System applies change
```

Do not add:
- payroll
- GPS
- POS
- inventory
- accounting
- generic ERP modules
- biometric attendance
- microservices

Do not run:

```bash
prisma migrate reset
```

Do not drop schemas.

Do not touch unrelated data.

---

## Required Stack

Respect the current stack:

```text
Next.js + TypeScript + Tailwind CSS + shadcn/ui
NestJS + TypeScript
PostgreSQL + Prisma
Modular monolith
```

---

## Required Skill Inspection

Before planning, inspect all available local skills.

Look in at least:

```text
.agents/skills
skills
```

Required skills to inspect and apply if present:

```text
supernova-product-architect
supernova-ui-ux-pro-max
supernova-refactor-debug-review
clean-code-guard
test-guard
frontend-ui-engineering
TDD / test-driven-development if present
browser / browser-verification if present
verification-before-completion if present
```

Important:

```text
The user explicitly requested ui-ux-pro-max.
```

If `supernova-ui-ux-pro-max` is not found:
1. Search all local skills directories for any similarly named UI/UX skill.
2. Search for `ui`, `ux`, `frontend`, `design`, `responsive`, `mobile`.
3. Use the closest local UI/UX skill found.
4. Report clearly which skill was used instead.
5. Do not download or install random external/untrusted skills into the repo.
6. If a trusted project skill source exists inside the repo, use it only after inspection.

Do not use WordPress/WooCommerce skills.

---

## Required Safety Checks Before Edits

Run and report:

```bash
git branch --show-current
git status --short
```

If there are unrelated uncommitted changes, stop and report them.

Do not create a new branch unless explicitly instructed.

Do not commit.

---

## Required Repo Inspection Before Planning

Inspect current implementation first:

```text
docs/orders-kpi-v2-product-contract.md
apps/api/src/orders-kpis/**
apps/api/test/orders-kpis-*.test.ts
apps/web/app/admin/reports/orders-kpi/page.tsx
apps/web/components/orders-kpis/**
apps/web/lib/api/orders-kpis.ts
apps/web/lib/api/orders-kpis.test.ts
apps/web/components/dashboard/role-nav.ts
apps/web/components/reports/**
apps/web/components/ui/**
apps/web/app/admin/settings/**
apps/web/app/**/settings/**
apps/api/src/settings/**
apps/api/src/**/settings/**
prisma/schema.prisma
```

Also inspect existing UI patterns for:
- date range control
- select/dropdown components
- shadcn cards
- badges
- tabs
- tables
- dialogs
- settings pages
- mobile responsive components
- existing report pages

Then write a short product/technical plan before edits.

---

# User's Required Design Direction

The current Orders KPI Report page is functionally working but visually and operationally weak.

The user wants a professional KPI performance page, not a basic report table.

The old page problems include:
- awkward full-width date range
- poor spacing
- Picker View can appear empty without enough context
- weak KPI cards
- no performance dashboard feel
- no flexible business filters
- not clear who is in target vs out of target

---

## Target Page Layout

Route remains:

```text
/admin/reports/orders-kpi
```

Do not change the route.

### 1. Top Header Area

At the top, show a clean compact page header:

```text
Orders KPI Performance
Vendor-first operational KPI workspace
```

Date range must be in the top area, aligned to the right on desktop.

Date range design rules:
- compact
- visually polished
- not full-width like the current screenshot
- good spacing
- mobile-friendly
- no horizontal overflow

On mobile, date range can stack under the title.

---

### 2. KPI Cards Row

Directly under the header/date range, show 8 performance cards:

```text
Total Orders
UHO
UHO %
Not on Time
QC Failed Orders
Partial Refund
OOS
Price Modified
```

Each card must include:
- icon representing the metric
- metric name
- main number or percentage
- delta change
- trend-ready mini visual area if selected range is more than one day

Card style should follow the user reference:
- compact dashboard card
- icon in a small rounded square/pill
- main value prominent
- delta shown below
- trend line / sparkline area placed subtly

Important:
- Do not invent fake delta data.
- Do not invent fake trend numbers.
- If backend does not return delta/trend yet:
  - Stage 1 UI may show a neutral placeholder such as `Comparison not available yet`, or hide delta/trend cleanly.
  - Later backend stage must provide real comparison/trend data.
- UHO % is the most important KPI and should be visually emphasized, but not noisy.

---

### 3. Flexible Filters Area

Below KPI cards, add a professional filters/search area.

Required filters:

```text
Chain
Vendor
Picker
Global Search
```

Behavior:

#### Cascading filter rules

If user selects a Chain:
- Vendor filter should show only vendors belonging to that chain.
- Picker filter should show only pickers related to that chain's vendors/data.

If user selects a Vendor:
- Chain context should show/select the vendor's chain when known.
- Picker filter should show only pickers related to that vendor.
- Chain tab should show the chain of that vendor.
- Vendor tab should show only the selected vendor.
- Picker tab should show pickers of that vendor.

If user selects a Picker:
- Chain/Vendor context should narrow to the picker-related records where possible.

Global search must search across:
- chain name
- chain id
- vendor name
- vendor id
- source vendor id
- shopper id
- picker name
- any useful visible report identity data

Do not implement fake client-side search over incomplete current page rows if backend support is needed.
If backend support is missing, add backend support in the backend stage.

---

### 4. Tabs Navigation

Below filters, show tabs:

```text
Chain
Vendor
Picker
```

These are view tabs, not destructive filters.

Tabs must work with current filters.

Examples:

#### No filters
- Chain tab: all chains
- Vendor tab: all vendors
- Picker tab: all pickers if backend supports this safely, otherwise show a clear guided state requiring Vendor/Chain context

#### Vendor selected
- Chain tab: selected vendor's chain
- Vendor tab: selected vendor
- Picker tab: pickers for selected vendor

#### Chain selected
- Chain tab: selected chain
- Vendor tab: vendors under selected chain
- Picker tab: pickers under selected chain

Do not leave Picker View as a confusing empty state. If context is required, say exactly what the user should select.

---

## 5. Tables Per Tab

Each tab has a dedicated table/card view.

### Shared visible columns

For Chain, Vendor, and Picker views show:

```text
Name
Total Orders
UHO
UHO %
Not on Time
QC Failed Orders
OOS
Partial Refund
Price Modified
Target Status
```

Every column header for numeric metrics must support sorting:

```text
click header -> sort ascending/descending
```

Do not rely mainly on dropdown sort controls like the current page.

Rows must show deltas next to numbers in a polished way where backend data exists.

If delta backend data is not available yet, keep delta placeholders hidden or neutral until backend stage provides it.

### Chain View

Show all chains with:

```text
chain name
total orders
uho
uho %
not on time
qc failed orders
oos
partial refund
price modification
target status
```

Include Unmapped Chain if data exists.

### Vendor View

Show all vendors or filtered vendors with the same metrics.

Include Unmapped Vendor `<sourceVendorId>` rows if data exists.

### Picker View

Show all relevant picker/bucket rows with same metrics.

Must include:
- matched picker
- unmatched shopperId
- unknown picker
- non-picker shopperId

Labels:
```text
Unmatched shopperId: <id>
Unknown Picker
Non-Picker shopperId: <id>
```

---

# Target System Requirements

The user wants a Settings area for targets.

Add a section in Settings:

```text
Orders KPI Targets
```

The target settings should allow Admin/Super Admin to set percentage targets for the main quality metrics.

Minimum targets:

```text
UHO %
Not on Time %
QC Failed %
Partial Refund %
OOS %
Price Modified %
```

Target meaning:
- Lower is better for these metrics.
- Example: UHO target <= 8%

Initial version can be global system-wide targets.

Do not build per-chain/per-vendor overrides yet unless already trivial and scoped.

## Target Evaluation Rules

The primary target is:

```text
UHO %
```

If UHO % is outside target:
- row is considered `Out of Target`
- row must have a clear visual status badge/marker
- row should be visually distinct but not ugly/noisy

If UHO % is within target:
- row is generally `In Target`

If other metrics are outside target while UHO is in target:
- row remains generally in target
- the specific metric value should show warning styling
- do not mark the whole entity as fully out of target only because of a secondary metric

Display target status in:
- Chain rows
- Vendor rows
- Picker rows
- KPI card context where useful

---

# Backend/API Enhancements Required

Current API may not support all requested UX.

You may add backend enhancements only as needed for this goal, but keep them scoped to Orders KPI.

Do not change Attendance.

Likely needed backend additions:

```text
- previous period comparison
- delta values for KPI cards and row metrics
- trend data or trend-ready summary for KPI cards when date range > 1 day
- filter options endpoint or embedded options for chains/vendors/pickers
- global search support
- target settings model/API
- target evaluation in report response
```

## Delta Rules

Delta must compare current selected period to previous equivalent period.

Example:
- selected dateFrom/dateTo = Jun 6 to Jun 9 = 4 days inclusive
- previous period = Jun 2 to Jun 5

For counts:
```text
delta = current - previous
deltaPercent = ((current - previous) / previous) * 100
```

If previous is 0:
- handle safely
- do not show Infinity
- return null or a clear safe state

For rates:
```text
delta = currentRate - previousRate
```

Use clear response fields.

## Trend Rules

For date ranges longer than one day:
- provide real daily trend points where feasible
- do not fake trend
- each KPI card can use daily aggregated values
- frontend can draw simple small sparkline using real points

No chart library is required unless already present.
A simple SVG sparkline component is acceptable.

---

# Recommended Staged Execution

Do not implement everything as one uncontrolled batch.

## Stage 0 — Inspect + Plan Only

Tasks:
- inspect repo
- inspect skills
- inspect current Orders KPI UI/API
- inspect settings patterns
- produce a concise implementation plan

No code changes except notes if needed.

Proceed only if safe.

---

## Stage 1 — UI Redesign Using Current API

Scope:
- redesign `/admin/reports/orders-kpi`
- new header/date range layout
- new KPI cards shell
- better filters area layout
- tabs layout
- professional table/mobile cards
- sortable column headers using existing API sort if available
- no fake delta/trend
- no targets yet unless API already exists

Allowed files:
```text
apps/web/components/orders-kpis/**
apps/web/app/admin/reports/orders-kpi/page.tsx
apps/web/lib/api/orders-kpis.ts only if needed for types
```

Checks:
```bash
npm run typecheck
npm run lint
npm run build
```

Stop if UI breaks.

---

## Stage 2 — Report API Enhancements

Scope:
- add backend report fields for:
  - delta/comparison
  - trend points
  - flexible search
  - filter options if needed
- update frontend API types
- update report UI to consume real delta/trend data

Allowed backend area:
```text
apps/api/src/orders-kpis/**
apps/api/test/orders-kpis-*.test.ts
```

Allowed frontend area:
```text
apps/web/lib/api/orders-kpis.ts
apps/web/components/orders-kpis/**
```

Tests:
```bash
npx tsx apps/api/test/orders-kpis-performance-report.test.ts
npx tsx apps/web/lib/api/orders-kpis.test.ts
npm run typecheck
npm run lint
npm run build
```

---

## Stage 3 — Orders KPI Target Settings

Scope:
- add minimal Prisma model/config storage for global Orders KPI targets if no existing settings store exists
- add backend API for getting/updating Orders KPI targets
- add Admin/Super Admin Settings UI section:
  ```text
  Orders KPI Targets
  ```
- add tests

Important:
- Do not modify Attendance settings.
- Do not introduce generic ERP settings framework.
- Keep settings scoped to Orders KPI targets.

Possible target fields:
```text
uhoRateTarget
notOnTimeRateTarget
qcFailedRateTarget
partialRefundRateTarget
oosRateTarget
priceModifiedRateTarget
```

Rates are percentages.

Run migrations safely:
```bash
npm run prisma:validate
npm run prisma:migrate
npm run prisma:generate
```

Do not run reset.

---

## Stage 4 — Target Evaluation in Report

Scope:
- report API includes target settings and row/card target evaluation
- UI displays:
  - In Target
  - Out of Target
  - secondary metric warnings
- UHO target is the primary row status driver
- secondary metrics show metric-level warning only

Tests:
```bash
npx tsx apps/api/test/orders-kpis-performance-report.test.ts
npx tsx apps/web/lib/api/orders-kpis.test.ts
npm run typecheck
npm run lint
npm run build
```

---

## Stage 5 — Final UX Polish + Browser Verification

Scope:
- mobile 360px–430px
- no horizontal overflow
- good card spacing
- clear empty/loading/error states
- accessible labels
- no fake dashboard clutter
- professional visual hierarchy

Manual browser checks:
```text
/admin/reports/orders-kpi
Settings -> Orders KPI Targets
Chain tab
Vendor tab
Picker tab
Date range
Cascading filters
Search
Sorting headers
Mobile viewport 360px–430px
```

---

# Required UI/UX Quality Bar

The final page must feel like a professional operational KPI workspace.

It must not look like:
- a generic SaaS dashboard
- a raw database table
- a half-finished admin page
- a cluttered analytics toy

It must prioritize:
- clear performance judgment
- fast filtering
- target visibility
- metric comparison
- readable mobile layout
- zero horizontal overflow

---

# Data Honesty Rules

Never show fake data.

Never show fake delta.

Never show fake trend.

Never show fake targets.

If data is unavailable:
- show a neutral unavailable state
- or hide the section until backend supports it

---

# Tests And Checks Required At End Of Full Goal

Run everything relevant:

```bash
npm run prisma:validate
npm run prisma:generate
npx tsx apps/api/test/orders-kpis-import-preview.test.ts
npx tsx apps/api/test/orders-kpis-confirm-replace.test.ts
npx tsx apps/api/test/orders-kpis-performance-report.test.ts
npx tsx apps/web/lib/api/orders-kpis.test.ts
npm run typecheck
npm run lint
npm run build
git diff --check
```

If a migration is added:

```bash
npm run prisma:migrate
```

Do not claim any check passed unless it actually ran.

---

# Manual Verification Required

If possible, run browser verification.

Verify:
1. Report loads for Admin.
2. Date range is compact and visually polished.
3. 8 KPI cards render.
4. Delta/trend are real or hidden/neutral if not available.
5. Chain/Vendor/Picker filters work.
6. Cascading filter behavior works.
7. Search works across expected identity fields.
8. Tabs work with filters.
9. Header sorting works.
10. Targets settings can be opened and saved.
11. In Target / Out of Target visuals display correctly.
12. Mobile 360px–430px has no horizontal overflow.

If browser/admin session cannot be verified, say exactly what was not verified.

---

# Final Response Format

After each stage, respond with:

```text
Stage Completed
Summary
Files Changed
Tests/Checks Run
Manual Verification
Known Risks
Can Proceed To Next Stage: Yes/No
```

After the full goal, respond exactly:

```text
Summary
Skills Inspected
Relevant Skills Applied
Current Branch
Stages Completed
Files Changed
Routes Added/Changed
API Changes
Database/Migration Changes
Behavior Added
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommendation
```

Completion Status should be:

```text
Orders KPI Professional Performance Workspace + Targets complete
```

If you stop before completion, use:

```text
Stopped before full goal completion
```
