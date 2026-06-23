# Agent Workflow

## Required Start

Before implementation work:

```text
1. Inspect the repo.
2. Summarize current behavior.
3. Identify the real product problem.
4. Propose a short scoped plan.
5. Keep changes inside the approved scope.
```

For documentation-only work, inspect the relevant docs and source claims before editing.

## Scope Discipline

Every task must state:

- Problem.
- Current behavior.
- Target behavior.
- Scope.
- Out of scope.
- Files likely involved.
- Data/API impact.
- Security/scope impact.
- UI/UX impact when relevant.
- Verification plan.

Do not mix refactor, feature work, UI redesign, schema migration, and security changes unless the current task explicitly scopes all of them.

## Repo Inspection

Use direct repo inspection first:

```powershell
rg --files
rg -n "term"
git status --short
```

Prefer local source, package scripts, Prisma schema, controllers, services, and current UI components over memory or old docs.

## Documentation Rules

Documentation is a set of claims about the codebase.

When writing docs:

- Verify file paths exist.
- Verify commands exist in `package.json`.
- Verify API paths against controllers before listing them.
- Verify model and enum names against `prisma/schema.prisma`.
- Remove unverifiable claims.
- Remove old one-off prompts and duplicate planning notes.
- Do not keep TODO stubs or "coming soon" promises in official docs.

## Implementation Rules

Preserve existing product rules unless the task explicitly changes them.

Backend tasks must validate:

```text
Authentication
Role
Permission
Operational scope
Entity state
Request state
Audit logging
```

UI tasks must:

```text
Design mobile-first for 360px-430px
Avoid fake data
Avoid horizontal overflow
Keep backend behavior unchanged unless scoped
```

Refactors must preserve observable behavior unless a bug fix is explicitly approved.

## Verification Tiers

Docs only:

```powershell
git diff --check
git status --short
```

Frontend UI only:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
```

Frontend behavior or page structure:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
npm run build --workspace @supernova/web
```

Backend, Prisma, workflow, or full-stack changes:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
```

Never claim a check passed unless it actually ran.

## Final Response Format

Every implementation response must include:

```text
Summary
Files Changed
Behavior Changes
Tests/Checks Run
Manual Verification
Known Risks
Completion Status
Next Recommendation
```

For documentation cleanup responses, also include:

```text
Files Deleted
Rules Preserved
Docs Created/Updated
Ignored Local Docs Reviewed
```

Completion status must be one of:

```text
Complete
Complete with known risks
Blocked
Partially complete
Rejected / needs correction
```

## Local Agent Assets

Tracked local skills under `.agents/skills` and `.claude/skills` are reusable agent assets. Do not delete them during documentation cleanup unless the product owner explicitly asks for that cleanup.
