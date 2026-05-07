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
