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

Phase 0 creates these backend modules only as foundation:

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

## Phase 0 Scope Guard

Phase 0 establishes scaffolding only. It does not implement:

- New Hire flow
- Transfer flow
- Resignation/Termination flow
- Production auth
- Full dashboards
- Approval decision logic
