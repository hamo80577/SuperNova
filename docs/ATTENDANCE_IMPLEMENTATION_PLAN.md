# Attendance Analytics Implementation Plan

## Phase 0 - Docs and Repo Alignment

Goal:

```text
Create the current documentation set and archive outdated docs without product code changes.
```

Scope:

```text
docs archive
current product docs
attendance spec docs
README and AGENTS alignment
```

Out of scope:

```text
Prisma schema
migrations
API modules
UI pages/routes
runtime behavior
access-control logic
package changes
```

Acceptance criteria:

```text
old docs are archived by copy or move
current docs exist
attendance scope and guardrails are explicit
implementation phases are documented
working tree contains docs-only changes
```

Required checks:

```powershell
git diff --check
git status
```

## Phase 1 - Prisma Data Model Foundation

Goal:

```text
Add the minimum database foundation for attendance imports, calculated records, summaries, and import issues.
```

Scope:

```text
Prisma models
migration
indexes
enum/status design
retention-ready schema
audit model review if needed
model-level documentation update
```

Out of scope:

```text
file parsing
calculation engine
UI routes
report pages
maintenance operations
automation
```

Acceptance criteria:

```text
schema supports import batches, daily records, monthly summaries, and issues
schema does not store original XLSX files
schema does not add hierarchy fields to User
schema cannot mutate lifecycle state through attendance tables
indexes support period, user, role, branch, chain, and batch lookups
```

Required checks:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
```

## Phase 2 - Import and Calculation Engine

Goal:

```text
Build backend import, matching, validation, calculation, and summary rebuild logic.
```

Scope:

```text
file intake without permanent file storage
source column validation
Egypt row filtering
Picker and Champ matching
duplicate detection
calculation functions
daily record creation
monthly summary rebuilds
import issue persistence
batch status/progress
unit tests for calculations and matching
```

Out of scope:

```text
Super Admin UI
report pages
destructive data maintenance
retention automation
payroll or deductions
```

Acceptance criteria:

```text
imports never create or mutate users
normal imports never mutate active/current assignments or workflow state
role matching uses SuperNova User.role only
non-Egypt rows are counted and ignored
duplicate Identifier + Shift Date creates warnings
late and shift metrics match approved rules
batch status survives browser close
```

Required checks:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
targeted backend tests
```

## Phase 2B - Historical Assignment Backfill Foundation

Goal:

```text
Add backend-only preview and confirmation support for closed historical PickerBranchAssignment records derived from Attendance Location.
```

Scope:

```text
identifier normalization stabilization
historical assignment snapshot by date window
fatal parser error handling
Location code parsing
historical backfill preview service
historical backfill confirmation service
focused backend tests
docs alignment for the approved exception
```

Out of scope:

```text
public upload endpoint
Super Admin UI
report pages
scheduled retention job
current active assignment mutation
CHAMP branch assignment creation
payroll or deductions
```

Acceptance criteria:

```text
normal attendance import never automatically creates assignments
preview proposes only closed past PICKER assignment ranges
confirmation refuses overlapping or open-ended proposals
current active assignments are never changed, closed, deleted, or replaced
Location is used as assignment source
Shift Location is not used as assignment source
unmapped or conflicting Locations require review
fatal workbook issues fail the batch instead of completing with warnings
```

Required checks:

```powershell
targeted attendance tests
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
git diff --check
```

## Phase 3 - Super Admin Upload and Import History UI

Goal:

```text
Add the Super Admin Attendance Data Operations upload and import history experience.
```

Scope:

```text
/super-admin/attendance-operations route
SUPER_ADMIN-only route protection
Upload Attendance tab
Import History tab
file selector
period fields
upload mode control
preflight summary
processing stepper
polling backend batch status
final summary
warnings/issues display
frontend API client functions
```

Out of scope:

```text
data maintenance
retention compression
admin/area manager/champ reports
calculation rule editing
```

Acceptance criteria:

```text
Super Admin can run approved upload modes
non-Super Admin access is blocked by backend and UI route protection
browser close does not lose backend batch status
final summary shows counts and issues
source file is not permanently stored
mobile and desktop layouts are usable
```

Required checks:

```powershell
npm run typecheck
npm run lint
npm run build
manual upload flow smoke test
mobile 360/390/430 verification
```

## Phase 4 - Data Maintenance and Retention/Compression

Goal:

```text
Add safe Super Admin data maintenance and old-month compression.
```

Scope:

```text
delete by date range
delete month
delete all attendance data
recalculate summaries
compress old months
impact previews
typed confirmations
audit logs
final summaries
maintenance issues
```

Out of scope:

```text
scheduled automation
role-scoped report pages
payroll or deductions
```

Acceptance criteria:

```text
dangerous operations require impact preview and typed confirmation
delete operations affect attendance tables only
users, assignments, requests, approvals, notifications, audit logs, and access-control data are untouched
compression removes old daily details after monthly summaries are rebuilt
audit logs record actor, operation, target period, counts, and result
```

Required checks:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
targeted backend tests
manual dangerous-operation confirmation smoke test
```

## Phase 5 - Admin Attendance Reports

Goal:

```text
Add Admin/Super Admin attendance reporting based on calculated records and summaries.
```

Scope:

```text
admin report APIs
period filters
Picker rollups
Champ user-level summaries
Branch and Chain summary views
issue-aware report states
frontend report components
```

Out of scope:

```text
Area Manager scoped reports
Champ scoped reports
data maintenance
payroll or deductions
```

Acceptance criteria:

```text
reports are read-only
Picker and Champ metrics are separated where required
Branch and Chain totals include Pickers only
reports use summaries for older months
empty/error/loading states are explicit
```

Required checks:

```powershell
npm run typecheck
npm run lint
npm run build
targeted API/report tests
manual Admin report smoke test
```

## Phase 6 - Area Manager and Champ Scoped Reports

Goal:

```text
Add scoped attendance reports for Area Manager and Champ workspaces.
```

Scope:

```text
Area Manager assigned Chain scope
Champ assigned Branch scope where approved
Area Manager Picker Attendance section
Area Manager Champ Attendance section
scope-enforced backend queries
frontend report views
```

Out of scope:

```text
Super Admin data operations
schema expansion unless proven necessary
payroll or deductions
```

Acceptance criteria:

```text
Area Managers see only assigned Chain scope
Champ reports follow assigned Branch scope
Area Manager UI separates Picker Attendance and Champ Attendance
Champ rows are never mixed into Picker rollups
out-of-scope access returns backend 403
```

Required checks:

```powershell
npm run typecheck
npm run lint
npm run build
targeted scope/access tests
manual Area Manager and Champ report smoke tests
```

## Phase 7 - Retention Automation and Production Polish

Goal:

```text
Automate retention, harden large imports, and prepare the attendance workstream for production operation.
```

Scope:

```text
retention job or admin-triggered scheduled path inside the monolith
large upload performance review
import timeout/retry behavior
observability/logging
production configuration docs
operator runbook
final regression pass
```

Out of scope:

```text
microservices
payroll
GPS
biometrics
live punch-in/out
order integration
inventory
accounting
```

Acceptance criteria:

```text
old-month compression can run safely and repeatably
large imports report progress and failures clearly
no permanent uploaded file storage exists
audit coverage exists for delete, recalculate, and compress
production runbook documents safe operations and recovery
```

Required checks:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
targeted backend tests
manual production-like import and retention smoke test
```
