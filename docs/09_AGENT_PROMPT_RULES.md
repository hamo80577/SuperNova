# 09 — Agent Prompt Rules

## Purpose

This document defines how to prompt Codex or any coding agent.

## Required Prompt Structure

Every implementation prompt should include:

```text
Project context
Task goal
Current behavior
Target behavior
Scope
Out of scope
Files to inspect
Implementation rules
Verification commands
Manual verification
Final response format
```

## Inspection First

Always tell the agent to inspect relevant files before editing.

Example:

```text
Before editing, inspect:
- apps/api/src/requests/workflows/new-hire-workflow.service.ts
- apps/api/src/requests/dto/create-new-hire-request.dto.ts
- apps/web/components/requests/request-components.tsx

Then write a short plan before edits.
```

## Scope Language

Use direct language.

Good:

```text
Do not change Transfer.
Do not add Email/OTP.
Do not reintroduce Termination.
Do not redesign unrelated pages.
```

Bad:

```text
Be careful.
Improve as needed.
```

## UI Prompt Rule

For UI tasks, include:

```text
Use ui-ux-pro-max if available.
Design mobile-first for 360px-430px.
Do not change backend behavior.
Do not add fake data.
Run frontend checks.
Report mobile verification.
```

## Backend Prompt Rule

For backend tasks, include:

```text
Preserve workflow behavior unless explicitly changing it.
Validate auth, role, scope, entity state, request state.
Add audit logs for sensitive changes.
Do not expose secrets.
Run backend/full-stack checks.
```

## Refactor Prompt Rule

Refactor prompts must say:

```text
Refactor only.
No behavior changes.
No route changes.
No DTO changes unless explicitly listed.
No Prisma schema changes unless explicitly listed.
Do not add features.
```

## Feature Prompt Rule

Feature prompts must say:

```text
This is a behavior change.
Document the new behavior.
Update docs.
Add/adjust validation.
Add audit/security review.
```

## Final Response Format

Use this:

```text
Summary
Files Changed
Spec Implemented
Behavior Changes
Behavior Preserved
Tests/Checks Run
Manual Verification
Security/Scope Review
Known Risks
Completion Status
Next Recommendation
```
