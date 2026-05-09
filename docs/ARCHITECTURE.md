# SuperNova Architecture

## Product Positioning

SuperNova is a Partner Workforce Operations System for Talabat-style operations. The core product model is:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP, and MVP scope does not include payroll, attendance, GPS, order integrations, mobile app work, microservices, or analytics warehousing unless explicitly requested later.

## Architecture Choice

SuperNova uses a modular monolith:

```text
apps/web   -> Next.js frontend
apps/api   -> NestJS backend
prisma/    -> shared PostgreSQL schema and migrations
packages/shared -> lightweight shared constants/types only
```

Rationale:

- The backend owns domain logic for assignments, requests, approvals, notifications, and audit logs.
- The frontend should never become the source of truth for security or lifecycle rules.
- The product needs transactional integrity and queryable history, which fit PostgreSQL and Prisma well.

## Backend Module Boundaries

The backend is organized around these modules:

- `AuthModule`
- `UsersModule`
- `ChainsModule`
- `VendorsModule`
- `AssignmentsModule`
- `RequestsModule`
- `ApprovalsModule`
- `NotificationsModule`
- `AuditModule`
- `AdminModule`
- `ReportsModule`

These modules should stay inside a single NestJS application unless a future scaling problem proves otherwise.

## Hierarchy and Ownership

The operational hierarchy is:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

This hierarchy must be derived from assignment tables:

- `PickerBranchAssignment`
- `VendorChampAssignment`
- `ChainAreaManagerAssignment`

Forbidden source-of-truth fields on `User`:

- `managerId`
- `chainId`
- `vendorId`

## Champ Operational Context

Champ workspaces and future Champ-initiated lifecycle actions are Branch-first.
Vendor/Branch is the active operational context for Champ actions.

- A Champ with one assigned Branch works inside that Branch context.
- A Champ with multiple assigned Branches may see aggregate dashboard data, but mutations/actions must begin from one selected Branch.
- New Hire, Transfer, Resignation, and Termination are launched from the selected Branch context.
- User-facing Champ workflow forms must derive `sourceChainId` and `sourceVendorId` from assignment context instead of asking the Champ to choose them manually.
- `/api/workspaces/champ/branches` and `/api/workspaces/champ/branches/:vendorId` are read-only scoped endpoints. They require `CHAMP` role and return only Branches with an active `VendorChampAssignment` for the authenticated Champ.
- `/champ/dashboard` is an aggregate overview. `/champ/branches/:vendorId` is the operational workspace where future Champ lifecycle forms should start.

## Security Boundary

Every backend mutation must eventually validate:

- Authentication
- Role
- Scope
- Entity state
- Request state
- Approval ownership

Frontend hiding is not security.

## Auth and Session Design

Phase 1 uses phone-number and password login through the NestJS API.

- Passwords are hashed with bcrypt.
- Browser sessions use an HTTP-only JWT cookie.
- Cookie settings use `sameSite=lax`, `httpOnly=true`, and `secure=true` in production.
- The backend guard also accepts `Authorization: Bearer <token>` for API testing.
- `JWT_SECRET` is required through environment configuration.
- Safe user responses must never include `passwordHash` or temporary password material.

Role redirects:

- `PICKER` -> `/picker/dashboard`
- `CHAMP` -> `/champ/dashboard`
- `AREA_MANAGER` -> `/area-manager/dashboard`
- `ADMIN` -> `/admin/dashboard`
- `SUPER_ADMIN` -> `/admin/dashboard`

## Organization Management API

Phase 2 adds Admin/Super Admin CRUD for organization structure only:

- Chains
- Vendors / Branches

These endpoints use the existing JWT auth guard, roles guard, DTO validation, Prisma services, and audit logging. List endpoints support pagination, search, and filtering. Vendor records must belong to an existing Chain.

Phase 2 does not assign Pickers, Champs, or Area Managers. Assignment tables remain data model foundation only until the assignment engine phase.

## Assignment Engine Foundation

Phase 3 enables Admin/Super Admin setup for the operational hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

The backend derives management context through assignment tables only. It does not read or write `User.managerId`, `User.chainId`, or `User.vendorId`.

Assignment creation preserves history. Admin setup rejects duplicate active assignments instead of auto-closing older rows; automatic close-and-create behavior belongs to New Hire and Transfer workflows.

The assignment API provides:

- current Picker context with Vendor, Chain, Champ, and Area Manager summaries
- current Vendor Champ lookup
- current Chain Area Manager lookup
- paginated assignment history lists
- create and close actions with audit logs

Phase 3 access is intentionally Admin/Super Admin only. Picker, Champ, and Area Manager scoped workspaces are prepared by the data model but remain later phases.

## Phase 2 Scope Guard

Phase 2 establishes organization structure management. It does not implement:

- New Hire flow
- Transfer flow
- Resignation/Termination flow
- Request engine
- Approval engine
- Assignment engine
- Picker creation
- Full role dashboards
- Approval decision logic

## Phase 3 Scope Guard

Phase 3 establishes assignment hierarchy management. It does not implement:

- New Hire workflow
- Transfer workflow
- Resignation/Termination workflow
- Request engine
- Approval engine
- direct Picker creation
- role-scoped dashboards
- Area Manager operations map
- Champ "My Pickers" workspace

## Role Workspace Foundation

Phase 4 adds read-only workspace APIs and dashboards for each operational role.

Workspace visibility is still derived from assignment tables:

- Picker workspace reads the current active Picker Branch assignment, then derives Vendor, Chain, Champ, and Area Manager context.
- Champ workspace reads active Vendor Champ assignments for the authenticated Champ and shows only those branches and active Picker assignments under them.
- Champ Branch workspace detail reads one active Vendor Champ assignment, derives the Branch Chain and Area Manager from assignment tables, and shows branch-local Pickers and request history without mutation behavior.
- Area Manager workspace reads active Chain Area Manager assignments for the authenticated Area Manager and shows only those Chains, Vendors, Champs, and Pickers under that scope.
- Admin workspace reads system-wide organization and assignment counts with links to controlled Admin pages.

The frontend consumes role-specific workspace endpoints, but backend role guards and scoped queries enforce the actual security boundary. These endpoints are read-only and do not create requests, approvals, transfers, or lifecycle actions.

## Phase 4 Scope Guard

Phase 4 establishes role workspaces. It does not implement:

- Request engine
- Approval engine
- New Hire workflow
- Transfer workflow
- Resignation/Termination workflow
- lifecycle mutation actions from role workspaces
- direct Picker creation
- direct Picker branch edits

## Generic Request and Approval Engine

Phase 5 adds reusable lifecycle request infrastructure. Phase 6 adds New Hire finalization on top of that engine. Phase 8 adds Resignation/Termination finalization. Phase 9 adds Transfer execution.

The engine owns:

- request creation as `DRAFT`
- request submission and approval step generation
- approval ownership checks by role and assignment-derived scope
- request status transitions
- request timeline responses from request, approval, and audit data
- in-app notifications for request and approval events
- audit logs for request and approval actions

Approval ownership is enforced in the backend:

- Area Manager approval steps require an active `ChainAreaManagerAssignment` for the request Chain context.
- Admin final approval steps require `ADMIN` or `SUPER_ADMIN`.
- Transfer approval steps use source and destination Chain context. The final required Transfer approval applies the assignment move and completes the request.

Generic approval completion does not apply final actions. New Hire reaches `COMPLETED` only through the Phase 6 Admin finalization endpoint. Resignation/Termination reach `COMPLETED` only through the Phase 8 Admin offboarding finalization endpoint. Transfer reaches `COMPLETED` only when the Phase 9 approval path applies the old-assignment close and new-assignment create transaction.

The generic request creation UI is internal Admin/Super Admin tooling for testing
the Phase 5 engine only. It is not a Champ operations form and must not be shown
as a user-facing workflow launcher for Picker lifecycle actions.

## Phase 5 Scope Guard

Phase 5 by itself does not implement:

- Picker archive/deactivation from Resignation or Termination
- direct assignment mutation from request approval
- payroll, attendance, GPS, order integration, mobile app, microservices, or analytics warehouse

## New Hire Workflow

Phase 6 adds the first workflow-specific system application path while preserving
the request and approval architecture.

Backend responsibilities:

- `POST /api/requests/new-hire` is CHAMP-only and validates active Branch scope through `VendorChampAssignment`.
- The API derives source Chain from the selected Branch and assigns the Area Manager approval from `ChainAreaManagerAssignment`.
- `POST /api/requests/:id/finalize-new-hire` is Admin/Super Admin-only and requires Shopper ID.
- Finalization runs in one Prisma transaction: approve Admin final step, create Picker, create active `PickerBranchAssignment`, complete the request, notify the Champ, and write audit logs.
- Temporary passwords are hashed on `User`; the plain temporary password is only written to the Champ notification after successful finalization.

Frontend responsibilities:

- Champ launches New Hire only from `/champ/branches/:vendorId/new-hire`.
- The form shows read-only Branch, Chain, and Area Manager context and does not expose source IDs.
- Admin finalization appears on the request detail page only when the request is a New Hire at the Admin final step.
- The approval queue routes New Hire Admin final approvals to request detail instead of allowing generic approval bypass.

Phase 6 still does not implement Transfer or Resignation/Termination
finalization. The created Picker is intentionally left with
`profileStatus=INCOMPLETE` for Phase 7 onboarding.

## Picker Profile Completion

Phase 7 adds the onboarding step after New Hire finalization and forced
password change.

Flow:

```text
Picker login with temporary password
-> forced password change
-> profile completion
-> full Picker workspace
```

Backend responsibilities:

- `GET /api/users/me/profile-completion` returns safe Picker profile completion state.
- `PATCH /api/users/me/profile-completion` is PICKER-only and updates only safe self-service fields.
- Required fields are `nationalId`, `address`, `dateOfBirth`, and `joiningDate`.
- The endpoint sets `profileStatus=COMPLETE` when required fields are valid.
- The endpoint writes `PICKER_PROFILE_COMPLETED` audit logs.

Security boundaries:

- Pickers cannot update `role`, `accountStatus`, `employmentStatus`, `blockStatus`, `shopperId`, `ibsId`, password fields, assignment fields, or lifecycle request fields through profile completion.
- `mustChangePassword` has routing priority over profile completion.
- Incomplete Pickers are redirected to `/picker/profile-completion` before the full Picker workspace.

Phase 7 does not implement document upload storage, Admin profile review,
Transfer, Resignation, or Termination.

## Resignation / Termination Workflow

Phase 8 adds Branch-first offboarding finalization while preserving the request
and approval architecture.

Backend responsibilities:

- `POST /api/requests/offboarding` is CHAMP-only and validates active Branch scope through `VendorChampAssignment`.
- The API accepts only `RESIGNATION` or `TERMINATION`, derives source Chain from the selected Branch, and limits the target Picker to active `PickerBranchAssignment` rows for that Branch.
- Duplicate pending offboarding requests for the same Picker are rejected.
- Area Manager approval is scoped through the source Chain `ChainAreaManagerAssignment`.
- `POST /api/requests/:id/finalize-offboarding` is Admin/Super Admin-only and requires block status plus explicit internal deactivation confirmation.
- Finalization runs in one Prisma transaction: approve Admin final step, archive the Picker account, save employment and block status, close the active `PickerBranchAssignment`, complete the request, notify the Champ, and write audit logs.
- Archived Pickers cannot log in because auth rejects non-`ACTIVE` accounts.

Frontend responsibilities:

- Champ launches Resignation from `/champ/branches/:vendorId/resignation`.
- Champ launches Termination from `/champ/branches/:vendorId/termination`.
- Forms show read-only Branch, Chain, and Area Manager context and do not expose source IDs.
- Picker selection is limited to active Pickers returned by the scoped Branch workspace endpoint.
- Admin finalization appears on the request detail page only when the request is a Resignation or Termination at the Admin final step.
- The approval queue routes Admin final offboarding approvals to request detail instead of allowing generic approval bypass.

Phase 8 still does not implement Transfer execution, direct Picker archive tools,
reporting, payroll, attendance, GPS, order integrations, document uploads, or
analytics.

## Transfer Workflow

Phase 9 adds Branch-first Picker transfer execution while preserving assignment
history.

Backend responsibilities:

- `POST /api/requests/transfer` is CHAMP-only and validates active source Branch scope through `VendorChampAssignment`.
- The source Branch is derived from the selected Branch route context; Champ-facing forms do not expose `sourceVendorId` or `sourceChainId` as manual choices.
- The API limits the target Picker to active `PickerBranchAssignment` rows for the selected source Branch.
- The API validates the destination Branch is active, different from the source Branch, and derives destination Chain from the Vendor.
- Duplicate pending Transfer requests and pending offboarding requests for the same Picker are rejected.
- Same-chain Transfer creates only `SOURCE_AREA_MANAGER_APPROVAL`; cross-chain Transfer creates source and destination Area Manager approval steps.
- The final required approval runs one Prisma transaction: close the old active `PickerBranchAssignment`, create the new active `PickerBranchAssignment`, complete the request, notify the Champ and Picker, and write audit logs.

Frontend responsibilities:

- Champ launches Transfer from `/champ/branches/:vendorId/transfer`.
- The form shows selected source Branch/Chain context and limits Picker selection to active Pickers returned by the scoped Branch workspace endpoint.
- Destination Branch selection uses active Vendors and previews same-chain versus cross-chain approval path.
- Request detail shows source/destination Branch and Chain context plus assignment finalization IDs after completion.

Phase 9 does not add direct Picker assignment edit screens, Admin polish,
reporting, payroll, attendance, GPS, document uploads, or analytics.

## Admin Controls, Archive, and Audit Polish

Phase 10 adds Admin visibility over workflows already implemented in Phases 6,
8, and 9. It does not add a new workflow and does not change lifecycle mutation
rules.

Backend responsibilities:

- `GET /api/admin/pending-actions` returns Admin/Super Admin finalization work,
  including New Hire Shopper ID entry and Offboarding block/deactivation
  confirmation.
- `GET /api/admin/archived-users` returns safe archived/deactivated user rows
  with block status, latest offboarding request context, and closed assignment
  history.
- `GET /api/admin/audit-logs` returns paginated audit history with actor,
  entity, IP/user-agent, and redacted JSON old/new values.
- All Admin endpoints require authenticated `ADMIN` or `SUPER_ADMIN`.

Frontend responsibilities:

- `/admin/pending-actions` links Admins to request detail finalization panels.
- `/admin/archived-users` shows block state and closed assignment context.
- `/admin/audit-logs` shows paginated, filterable sensitive action history.
- `/admin/settings` is a read-only placeholder; no production setting mutation
  is enabled in Phase 10.

Phase 10 must not add direct buttons for Picker creation, Picker transfer,
Picker archive/deactivation, or Picker assignment changes. Those remain
workflow-based only.

## Reporting and Operational Counts

Phase 11 adds read-only reporting over existing operational data. It is not a
new workflow, not production hardening, and not an analytics warehouse.

Backend responsibilities:

- `GET /api/reports/admin/overview` returns system-wide counts for Admin/Super
  Admin users.
- `GET /api/reports/area-manager/overview` returns only data under the
  authenticated Area Manager's active `ChainAreaManagerAssignment` rows.
- `GET /api/reports/champ/overview` returns only data under the authenticated
  Champ's active `VendorChampAssignment` rows.
- Active Picker counts are based on active `PickerBranchAssignment` rows whose
  Picker user is active and employed.
- Request, approval, profile completion, archive, and block summaries are
  derived from existing rows and shaped into safe aggregate responses.

Frontend responsibilities:

- `/admin/reports` shows system overview, workforce status, requests, profile
  completion, archive/block, pending actions, and top Chain/Branch counts.
- `/area-manager/reports` shows Chain-scoped manpower, Branch counts, request
  summaries, pending approvals, and profile completion.
- `/champ/reports` shows assigned Branch counts, Picker profile completion,
  submitted request summaries, and workflow outcomes.

Reports must not expose secrets, raw temporary passwords, direct Picker creation,
direct transfer controls, direct archive/deactivation controls, or direct
assignment-edit controls.
