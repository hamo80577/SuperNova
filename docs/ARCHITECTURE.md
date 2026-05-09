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
- New Hire, Transfer, Resignation, and Termination forms in later phases must be launched from the selected Branch context.
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

Assignment creation preserves history. Admin setup rejects duplicate active assignments instead of auto-closing older rows; automatic close-and-create behavior belongs to future New Hire and Transfer workflows.

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

Phase 5 adds reusable lifecycle request infrastructure without implementing final workflow execution.

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
- Transfer approval steps use source and destination Chain context, but approval only moves the request to `APPROVED`.

Phase 5 approval completion never applies final actions. `COMPLETED` remains reserved for later phases where workflow-specific system application is implemented.

The generic request creation UI is internal Admin/Super Admin tooling for testing
the Phase 5 engine only. It is not a Champ operations form and must not be shown
as a user-facing workflow launcher for Picker lifecycle actions.

## Phase 5 Scope Guard

Phase 5 does not implement:

- Picker creation from New Hire
- Shopper ID finalization
- Picker assignment transfer execution
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

Phase 6 still does not implement Transfer, Resignation/Termination finalization,
or the Picker profile completion wizard.
