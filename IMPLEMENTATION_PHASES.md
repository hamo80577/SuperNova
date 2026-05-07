# SuperNova Implementation Phases

## Purpose

This file is the execution plan for building SuperNova with Codex GPT-5.5.

Codex must follow phases in order.

Do not start the next phase until the current phase passes its acceptance criteria.

## Global Codex Rules

For every phase:

1. Read `AGENTS.md`.
2. Inspect the existing repository structure before editing.
3. Identify relevant files and existing patterns.
4. Produce a short plan before changes.
5. Keep implementation inside the current phase.
6. Do not start future phases.
7. Add or update tests where appropriate.
8. Run available checks:
   - typecheck
   - lint
   - tests
   - build
9. Use strong backend validation and guards.
10. Use clean UI/UX patterns.
11. Use available plugins/superpowers/skills if present, especially:
    - `ui-ux-pro-max` for frontend UI/UX implementation and review
12. If a named plugin/skill is unavailable, do not hallucinate. Apply the same quality rules manually.
13. For any phase that touches backend, Prisma, database behavior, auth, API routes, protected frontend routes, assignments, requests, approvals, notifications, or audit logs, Codex must run local Docker/PostgreSQL verification.
14. Do not mark a backend/database/API phase complete unless the real local Docker PostgreSQL database was started, migrated, and used for verification.
15. End with:
    - Summary
    - Files changed
    - Tests/checks run
    - Local Docker/PostgreSQL Verification
    - Known risks
    - Whether the phase is complete

## Global Local Docker/PostgreSQL Verification Gate

SuperNova uses PostgreSQL through Docker Compose.

Codex must not treat backend/database work as complete just because TypeScript builds.

For any backend, Prisma, auth, API, protected frontend, assignment, request, approval, notification, or audit phase, Codex must verify against the real local Docker PostgreSQL setup.

Required verification commands where applicable:

```text
docker compose up -d postgres
docker compose ps
docker compose logs postgres --tail=80
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Alternative app startup is allowed when useful:

```text
docker compose --profile app up
```

Required verification evidence in final response:

```text
Docker compose status summary
Migration command result
Seed command result, if applicable
API health result
Manual endpoint verification summary
Manual UI verification summary, if frontend changed
Any issue that blocked real DB verification
```

If Docker PostgreSQL was not started, migrations were not applied, or new API/UI behavior was not verified against the local database, the phase status must be:

```text
NOT COMPLETE
```

Do not use `prisma db push` as the default path when migrations are expected. Use it only as a clearly explained temporary local fallback.

---

# Phase 0 — Repository Foundation

## Goal

Create the project foundation.

## Scope

Set up:

```text
Monorepo or clear repo structure
Next.js web app
NestJS API app
PostgreSQL/Prisma foundation
Shared conventions
Environment example
Docker Compose foundation
```

Phase 0 explicitly excludes:

```text
New Hire implementation
Transfer implementation
Resignation/Termination implementation
Role dashboards beyond placeholders
Fake approval logic
```

Recommended structure:

```text
supernova/
  apps/
    web/
    api/
  packages/
    shared/
  prisma/
  docs/
  AGENTS.md
  IMPLEMENTATION_PHASES.md
```

## Backend Requirements

Set up NestJS with modules placeholder:

```text
auth
users
chains
vendors
assignments
requests
approvals
notifications
audit
```

## Frontend Requirements

Set up Next.js with:

```text
Tailwind
shadcn/ui
Base app shell
Login placeholder
Role dashboard placeholders
```

## Acceptance Criteria

```text
Project runs locally.
Web app starts.
API app starts.
Prisma config exists.
Docker Compose exists for PostgreSQL.
Environment example exists.
No business workflows implemented yet.
Docs lock product direction and architectural constraints.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 1 — Auth, Users, Roles, and App Shell

## Goal

Implement secure authentication foundation and role-based navigation.

## Scope

Build:

```text
User model
Role enum
Account status enum
Profile status enum
Password hashing
Phone/password login
Temporary password support
Forced password change
Role-based redirect
Backend auth guard
Frontend app shell
Role-based sidebar
```

## User Fields

Implement baseline:

```text
id
ibsId
shopperId
role
nameEn
nameAr
phoneNumber
nationalId
address
dateOfBirth
gender
joiningDate
employmentStatus
resignationDate
accountStatus
profileStatus
blockStatus
blockedUntil
blockReason
passwordHash
mustChangePassword
temporaryPasswordExpiresAt
lastLoginAt
createdAt
updatedAt
```

## Acceptance Criteria

```text
User can login by phone/password.
Password is hashed.
Temporary password forces password change.
User is redirected by role.
Unauthorized dashboard access is blocked by backend and frontend.
No assignment logic yet.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 2 — Chains and Vendors/Branches

## Goal

Implement organization structure.

## Scope

Build:

```text
Chain model
Vendor model
Chain CRUD for Admin
Vendor CRUD for Admin
Chain profile
Vendor profile
Basic status management
Pagination/search
```

## Models

```text
Chain:
- id
- chainName
- chainCode
- status
- createdAt
- updatedAt

Vendor:
- id
- vendorName
- vendorCode
- vendorExternalId
- status
- chainId
- address
- area
- city
- createdAt
- updatedAt
```

## Acceptance Criteria

```text
Admin can create/update/view Chains.
Admin can create/update/view Vendors.
Vendor must belong to a Chain.
Lists are paginated.
Frontend forms are validated.
Backend validates all inputs.
```

Local Docker/PostgreSQL verification is required.

Codex must verify:

```text
PostgreSQL container starts and is healthy.
Prisma migrations are applied to the Docker database.
Seed command is run if needed.
API health endpoint works.
Admin login still works.
Chain create/list/update works against the real database.
Vendor create/list/update works against the real database.
Duplicate chain/vendor codes return clean conflict errors.
/admin/chains and /admin/vendors work in the browser.
```

Phase 2 is NOT COMPLETE if Docker PostgreSQL verification was skipped.

---

# Phase 3 — Assignment Engine

## Goal

Implement the operational hierarchy.

## Scope

Build:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
Assignment history
Active assignment constraints
Derived manager queries
Scope utility functions
```

## Critical Rule

Do not store manager relationships in User.

## Required Logic

Picker manager:

```text
Picker → active PickerBranchAssignment → Vendor → active VendorChampAssignment → Champ
```

Champ manager in branch context:

```text
Vendor → Chain → active ChainAreaManagerAssignment → Area Manager
```

## Acceptance Criteria

```text
One active branch assignment per Picker.
One active Champ assignment per Vendor.
One active Area Manager assignment per Chain.
Derived manager queries work.
Assignment history is preserved.
No direct Picker transfer UI yet.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 4 — Role Workspaces

## Goal

Build role-specific dashboards and scoped data views.

## Scope

Build:

```text
Picker workspace
Champ workspace
Area Manager workspace
Admin workspace
```

## Picker Workspace

```text
My Profile
My Branch
My Chain
My Champ
My Area Manager
```

## Champ Workspace

```text
My Branches
My Pickers
Requests placeholder
Actions placeholder
```

## Area Manager Workspace

```text
Operations Map
Chains under me
Branches under my Chains
Counts per Chain
Counts per Branch
Users under me
Requests placeholder
Approvals placeholder
```

## Admin Workspace

```text
All Chains
All Vendors
All Users
Pending admin actions placeholder
```

## UI/UX Requirement

Use professional dashboard UI.

If available, use:

```text
ui-ux-pro-max
```

for frontend review and polish.

## Acceptance Criteria

```text
Each role sees only their scoped data.
Area Manager can drill down Chain → Vendor → User.
Champ can see only assigned branches and Pickers.
Picker sees only own data.
Admin sees all.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 5 — Generic Request & Approval Engine

## Goal

Build reusable workflow infrastructure before specific requests.

## Scope

Build:

```text
Request model
RequestApproval model
Request status machine
Approval step engine
Request timeline
Approve/reject actions
Notifications foundation
Audit logs for request actions
```

## Request Types

```text
NEW_HIRE
RESIGNATION
TERMINATION
TRANSFER
```

## Request Statuses

```text
DRAFT
PENDING_AREA_MANAGER
PENDING_DESTINATION_AREA_MANAGER
PENDING_ADMIN
APPROVED
REJECTED
CANCELLED
COMPLETED
```

## Acceptance Criteria

```text
Requests can be created.
Approval steps can be generated.
Approvers can approve/reject only if in scope.
Request timeline is visible.
Audit logs are created.
No specific New Hire/Transfer finalization yet.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 6 — New Hire Workflow

## Goal

Implement New Hire end-to-end.

## Scope

Build:

```text
Champ New Hire form
Area Manager approval
Admin final approval
Shopper ID required
Picker user creation
PickerBranchAssignment creation
Temporary password generation
Notification to Champ
Forced password change
```

## Flow

```text
Champ submits New Hire
→ Area Manager approves
→ Admin approves with Shopper ID
→ System creates Picker
→ System assigns Picker to source Vendor
→ System sends credentials notification to Champ
```

## Hard Rules

```text
Champ can submit only for assigned branches.
Admin cannot finalize without Shopper ID.
Picker cannot be created directly outside this workflow.
Temporary password must be hashed.
Picker must change password on first login.
```

## Acceptance Criteria

```text
New Hire works end-to-end.
Created Picker is assigned to source Vendor.
Champ receives notification with phone/temp password.
Picker login with temp password forces change.
Audit logs exist.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 7 — Profile Completion Workflow

## Goal

Allow newly created Pickers to complete missing profile data.

## Scope

Build:

```text
Profile completion wizard
Required field validation
Profile status transitions
Profile completion dashboard indicators
```

## Wizard Steps

```text
Personal Info
Identity Info
Contact Info
Emergency Contact
Documents placeholder
Final Review
```

## Acceptance Criteria

```text
Incomplete Picker is redirected to completion.
Required fields are validated.
Profile status updates to COMPLETE or PENDING_REVIEW.
Picker cannot access full workspace until required profile data is completed.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 8 — Resignation / Termination Workflow

## Goal

Implement Picker resignation and termination request lifecycle.

## Scope

Build:

```text
Champ resignation/termination form
Area Manager approval
Admin final approval
Block status
Archive user
Disable login
Close active PickerBranchAssignment
Audit log
```

## Block Status

```text
NO_BLOCK
TEMPORARY_BLOCK
PERMANENT_BLOCK
```

## Acceptance Criteria

```text
Champ can submit only for Pickers under assigned branches.
Area Manager can approve only in scope.
Admin can finalize.
Archived user cannot login.
Assignment is closed, not deleted.
Block status is saved.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 9 — Transfer Workflow

## Goal

Implement Picker branch transfer.

## Scope

Build:

```text
Champ transfer request form
Destination Chain/Vendor selection
Same-chain approval logic
Cross-chain approval logic
Automatic assignment change
Assignment history
Notifications
Audit logs
```

## Same Chain

```text
Source Chain Area Manager approval is enough.
```

## Cross Chain

```text
Source Chain Area Manager approval
+ Destination Chain Area Manager approval
```

## Hard Rules

```text
No direct Picker assignment edit.
System must close old assignment and create new one.
Transfer only after all required approvals.
```

## Acceptance Criteria

```text
Same-chain transfer works.
Cross-chain transfer requires both Area Managers.
Assignment history is preserved.
Picker new branch is visible after completion.
Old assignment is inactive/closed.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 10 — Admin Controls, Archive, and Audit Polish

## Goal

Polish Admin control surfaces.

## Scope

Build:

```text
Admin pending actions
Archived users table
Block status view
Audit log table
Request details polish
System settings placeholders
```

## Acceptance Criteria

```text
Admin can see pending final actions.
Admin can view archived users.
Admin can inspect audit logs.
Sensitive actions are traceable.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 11 — Reporting and Operational Counts

## Goal

Add operational visibility.

## Scope

Build:

```text
Counts per Chain
Counts per Vendor
Users under Area Manager
Requests summary
Open actions summary
Profile completion summary
Archive/block summary
```

## Acceptance Criteria

```text
Area Manager can see manpower by Chain and Vendor.
Champ can see Picker counts.
Admin can see system-wide counts.
Reports use real data only.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.

---

# Phase 12 — Hardening and Production Readiness

## Goal

Make the system production-safe.

## Scope

Review and harden:

```text
Backend guards
Scope validation
Input validation
Pagination
Indexes
Transactions
Audit coverage
Password security
Error handling
Loading states
Empty states
Build pipeline
Docker deployment
Environment variables
```

## Acceptance Criteria

```text
No critical direct lifecycle bypass remains.
All sensitive mutations are guarded and audited.
Build passes.
Typecheck passes.
Tests pass where available.
Production env example is documented.
Docker deployment is documented.
```

Local Docker/PostgreSQL verification must be completed and reported before this phase can be marked COMPLETE.
