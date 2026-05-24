# Codex Workflow Rules

## Before Editing

Before code changes, inspect the relevant files and state:

```text
current behavior
exact gap
implementation plan
scope boundaries
verification tier
```

For documentation-only work, inspect current docs and state a short plan before edits.

## During Implementation

Keep changes scoped.

Preserve existing behavior unless the task explicitly changes it.

Do not combine unrelated work:

```text
feature work
schema changes
UI redesign
access-control changes
large refactors
dependency updates
```

Use backend validation for product rules. Frontend validation is not enough.

## Attendance Workstream Boundaries

Do not implement attendance code unless the task explicitly approves that phase.

Phase 0 is docs-only.

Attendance imports must not mutate:

```text
Users
Assignments
Requests
Approvals
User.role
User.shopperId
User.ibsId
employmentStatus
accountStatus
```

## Required Checks

Use the lightest verification tier that matches the change.

Docs-only:

```powershell
git diff --check
git status
```

Schema/backend:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
```

Frontend:

```powershell
npm run typecheck
npm run lint
npm run build
```

Full-stack or high-risk changes:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
targeted tests
manual smoke checks
```

Do not claim a check passed unless it actually ran.

## Final Response Format

For implementation work, final responses should include:

```text
Summary
Files Changed
Behavior Changes
Behavior Preserved
Tests/Checks Run
Manual Verification
Security/Scope Review
Known Risks
Completion Status
Next Recommendation
```

For task-specific prompts, use the exact final response format requested by the user.
