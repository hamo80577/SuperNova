# Access Control V1 Implementation Plan

## Important

This is a phased plan. Do not implement everything in one pass.

Every phase must preserve current behavior unless the task explicitly says otherwise.

## Phase 0 — Repo Inspection and Risk Map

Goal:

```text
Understand current role checks and approval coupling.
No code changes.
```

Agent should inspect:

```text
docs/REPO_INDEX.md
prisma/schema.prisma
apps/api/src/auth
apps/api/src/users
apps/api/src/workspaces
apps/api/src/requests
apps/api/src/approvals
apps/api/src/admin
apps/api/src/assignments
apps/api/src/reports
apps/api/src/notifications
apps/web/lib/auth
apps/web/components/auth
apps/web/components/dashboard
apps/web/components/users
```

Deliverable:

```text
Short audit in docs/access-control/ACCESS_CONTROL_AUDIT.md
```

Audit should classify findings:

```text
High-risk role coupling
Medium-risk role coupling
Acceptable role perimeter checks
Good assignment-scope patterns to preserve
```

## Phase 1 — Permission Catalog

Goal:

```text
Add central permission definitions.
No behavior change.
```

Expected outcome:

```text
apps/api/src/access-control/permissions.ts
```

The catalog should include metadata:

```text
key
label
group
riskLevel
description
```

Do not build UI yet.

## Phase 2 — Role Permission Matrix

Goal:

```text
Map existing system roles to permissions.
No behavior change.
```

Expected outcome:

```text
apps/api/src/access-control/role-permission.matrix.ts
```

Important:

```text
Admin and Super Admin must no longer be conceptually identical.
Admin = operational admin.
Super Admin = system owner.
```

## Phase 3 — AccessPolicyService

Goal:

```text
Create a central service for permission and scope checks.
Preserve current behavior.
```

Expected outcome:

```text
apps/api/src/access-control/access-policy.service.ts
apps/api/src/access-control/access-control.module.ts
```

Minimum API:

```ts
hasPermission(actor, permission)
can(actor, permission, context)
assertCan(actor, permission, context)
```

Context may include:

```text
chainId
vendorId
requestId
approvalId
targetUserId
sourceChainId
destinationChainId
```

## Phase 4 — Admin / Super Admin Split

Goal:

```text
Make system-level actions Super Admin-only.
Keep Admin operational.
```

Areas to inspect and update carefully:

```text
backend controller guards
backend services with isAdmin()
frontend redirects
frontend navigation
protected routes
admin dashboard pages
```

Do not remove Admin from operational finalization unless the new policy explicitly supports it.

## Phase 5 — Approval Authority Abstraction

Goal:

```text
Add authority mapping above current ApprovalStep values.
Do not rename ApprovalStep.
```

The routing logic should move toward:

```text
Who has authority for this chain/request?
```

instead of:

```text
Who has role AREA_MANAGER?
```

Preserve all current workflow behavior.

## Phase 6 — Gradual Role Check Migration

Goal:

```text
Move selected high-risk checks from raw role logic to AccessPolicyService.
```

Suggested order:

```text
Reports visibility
Users/profile visibility
Admin controls
Notifications admin targeting
Request listing
Approval decisions
Workflow creation/finalization
```

Do not migrate all services at once.

## Phase 7 — Optional DB-backed Custom Roles

Start only after Phases 1–6 are stable.

Possible future tables:

```text
AccessRole
AccessRolePermission
UserAccessRoleAssignment
```

Do not remove User.role.

## Phase 8 — Access Control UI

Start read-only first.

Preferred route:

```text
/super-admin/access-control
```

First UI should show:

```text
Permission catalog
System role matrix
Admin vs Super Admin differences
```

Only then add mutation flows.

## Phase 9 — Regression

Must verify:

```text
Login redirects
Picker profile completion
Champ workspace
Area Manager workspace
Admin dashboard
New Hire
Resignation
Transfer same-chain
Transfer cross-chain
Admin finalization
Approval decisions
Area Manager Chain assignment add/remove
Temporary password flows
Reports
Notifications
Audit logs
```

Required checks:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

Focused tests should include current workflow tests and new access-control tests.
