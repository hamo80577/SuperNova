# Agent Brief — Access Control V1

Use this file when working with Codex or Claude.

## Mission

Implement Access Control V1 safely.

Do not rewrite the system.

Do not break the working MVP.

The goal is to introduce a scalable permission/policy foundation while preserving current workflows.

## Must Inspect First

Before editing, inspect:

```text
docs/REPO_INDEX.md
docs/access-control/ACCESS_CONTROL_V1.md
docs/access-control/IMPLEMENTATION_PLAN.md
prisma/schema.prisma
apps/api/src/auth/guards/roles.guard.ts
apps/api/src/requests/request-approval-routing.service.ts
apps/api/src/approvals/approvals.service.ts
apps/api/src/requests/requests.service.ts
apps/api/src/users/users.service.ts
apps/api/src/admin/admin.controller.ts
apps/api/src/assignments/assignments.service.ts
apps/web/lib/auth/role-redirects.ts
apps/web/components/dashboard/role-nav.ts
```

If file paths changed, use `docs/REPO_INDEX.md` and direct repo inspection to find the current files.

## Hard Rules

Do not:

```text
Remove User.role
Remove UserRole enum
Rename ApprovalStep
Remove RequestApproval.approverRole
Remove RolesGuard
Remove @Roles decorator
Create direct Picker lifecycle bypass
Add Tenant/Country tables
Add custom roles UI before policy foundation
Touch unrelated UI redesign pages
Introduce microservices
```

## Implementation Style

Prefer small, reviewable phases.

Each phase should have:

```text
Short plan
Files to change
Behavior to preserve
Implementation
Checks
Risks
```

## Current Safe Interpretation

Raw role checks are acceptable for:

```text
workspace routing
coarse route perimeter
legacy compatibility during migration
```

Raw role checks are risky for:

```text
approval ownership
request lifecycle authority
admin/superadmin split
profile/password management
global reports
organization mutation
```

## Required Final Response Format

Every agent response must include:

```text
Summary
Files Changed
Behavior Preserved
Behavior Changed
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommended Phase
```

## First Task Recommendation

Start with Phase 0 only:

```text
Create docs/access-control/ACCESS_CONTROL_AUDIT.md
No code changes
No schema changes
No UI changes
```

The audit should list actual files and actual role-coupled logic found in the repo.
