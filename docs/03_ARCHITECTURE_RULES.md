# 03 — Architecture Rules

## Architecture Style

SuperNova must remain a modular monolith.

Do not introduce microservices.

## Backend Structure

Use NestJS modules with clear responsibilities.

Recommended module boundaries:

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
reports
admin
workspaces
```

## Service Design

Avoid huge services.

A service should have one primary responsibility.

Bad:

```text
requests.service.ts owns every workflow, every finalization, every policy, every lookup.
```

Good:

```text
requests.service.ts -> facade/query coordination
new-hire-workflow.service.ts -> New Hire lifecycle
transfer-workflow.service.ts -> Transfer lifecycle
offboarding-workflow.service.ts -> Resignation lifecycle
request-approval-routing.service.ts -> approval owner resolution
request-access-policy.service.ts -> visibility/scope decisions
```

## Refactor Rule

Refactor one workflow or one boundary at a time.

Do not mix:

```text
Refactor
Feature work
UI redesign
Schema migration
Security change
```

unless the task explicitly scopes all of them.

## API Contract Rule

Before changing an API contract, document:

```text
Old contract
New contract
Affected frontend files
Affected backend files
Migration/backward compatibility
Verification plan
```

## Prisma Rule

Use Prisma migrations for schema changes.

Do not use `prisma db push` as the normal development path.

## Data Access Rule

Data scope must be enforced in backend queries.

Frontend filtering is not security.

## Transaction Rule

Use transactions for lifecycle operations that must complete atomically.

Examples:

```text
New Hire finalization:
- approve admin step
- create/update user
- create assignment
- update request
- create notification
- create audit logs

Transfer application:
- close old assignment
- create new assignment
- update request
- create audit logs
```

## Error Handling Rule

Errors should be operational and safe.

Good:

```text
Selected Branch is not active.
You can submit New Hire only for assigned active Branches.
```

Bad:

```text
PrismaClientKnownRequestError P2002...
```

## Shared Code Rule

Shared helpers must be stable and small.

Do not create generic abstraction too early.

Prefer clear duplication over confusing abstraction until the pattern repeats.

## Integration Rule

External integrations must stay inside the modular monolith.

For the planned HR Google Sheets Sync:

```text
Use a small backend service boundary.
Do not introduce microservices.
Do not hardcode deployment URLs.
Use backend-only environment configuration.
Use shared-secret validation for webhook/App Script calls.
Record sync attempts in a dedicated log table before adding UI status.
Keep lifecycle workflow services authoritative for system state.
```
