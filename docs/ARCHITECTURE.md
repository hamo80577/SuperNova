# Architecture — SuperNova

## Architecture Style

SuperNova is a modular monolith.

Do not introduce microservices.

```text
apps/web  -> Next.js frontend
apps/api  -> NestJS backend
prisma    -> PostgreSQL schema/migrations/seed
packages/shared -> shared constants/types where appropriate
docs      -> product and technical documentation
```

## Product Architecture

SuperNova is structured around:

```text
Assignments
Requests
Approvals
Role-based Workspaces
```

The core hierarchy is:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

## Backend Modules

Main backend modules:

```text
auth
users
chains
vendors
assignments
workspaces
requests
approvals
notifications
audit
admin
reports
health
```

## Frontend Areas

Main frontend areas:

```text
auth screens
dashboard shell
role workspaces
champ branch workspace
request/approval surfaces
workflow forms
admin controls
reports
notifications
profile completion
```

## Assignment-Derived Scope

Do not store direct management relationships on `User`.

Do not use:

```text
User.managerId
User.chainId
User.vendorId
```

Use:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Examples:

Picker context:

```text
Picker -> active PickerBranchAssignment -> Vendor -> Chain
```

Picker Champ context:

```text
Picker -> active PickerBranchAssignment -> Vendor -> active VendorChampAssignment -> Champ
```

Champ Area Manager context:

```text
Vendor -> Chain -> active ChainAreaManagerAssignment -> Area Manager
```

## Workflow Architecture

Lifecycle workflows must follow:

```text
Request -> Approval -> System applies change
```

Workflow-specific endpoints exist for sensitive lifecycle operations:

```text
POST /api/requests/new-hire
POST /api/requests/offboarding
POST /api/requests/transfer
POST /api/requests/:id/finalize-new-hire
POST /api/requests/:id/finalize-offboarding
```

Generic request creation must not create workflow-specific lifecycle requests.

## Auth Architecture

- Browser auth uses HTTP-only JWT cookie.
- Backend guards also accept Bearer token for API testing.
- Login and JWT guard reject blocked/inactive accounts.
- `mustChangePassword` redirect has priority over profile completion.
- Incomplete Picker profile redirects after password change.

## Admin Architecture

Admin surfaces are visibility and finalization control surfaces.

Admin can inspect:

- pending final actions
- archived users
- audit logs
- reports
- settings placeholders

Admin must not get direct lifecycle bypass buttons for Picker creation, transfer, archive, or assignment change.

## Reporting Architecture

Reports are read-only.

Reports use live PostgreSQL data and assignment-derived scopes.

There is no BI warehouse, no materialized report store, and no fake static numbers in the MVP.

## UI Architecture

The current UI is being redesigned page by page.

Rules:

- Do not redesign the whole app in one pass.
- Do not change backend logic during UI-only work.
- Keep branch-first operations clear.
- Use reusable shell and component patterns.
- Prefer clean tables, cards, badges, timelines, and forms.

## Deployment Architecture

Local and VPS deployment are Docker Compose based.

Recommended production direction:

```text
Cloudflare / HTTPS reverse proxy
-> Web app
-> API app
-> PostgreSQL
```

Keep secrets outside git.

Run Prisma migrations before starting production services.
