# 00 — Project Operating System

## Purpose

This document defines how SuperNova must be planned, built, reviewed, tested, and evolved.

It is the operating system for developers and AI agents working on the project.

## Product Identity

SuperNova is a workforce operations system for partner branch operations.

It is built around:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

The product must stay operational, scoped, auditable, and workflow-safe.

## Development Philosophy

Build with these principles:

```text
Working product first
Clear workflows
Strong data ownership
Backend-enforced scope
Mobile-first UI
Small reviewed changes
No accidental broad rewrites
No fake shortcuts
```

## How Every Task Must Start

Every implementation task must begin with a short spec.

The spec must include:

```text
Problem
Current behavior
Target behavior
Scope
Out of scope
Files likely involved
Data/API impact
Security impact
Verification plan
```

No code should be changed before this is understood.

## Task Size Rules

Break work into small tasks.

Good task:

```text
Update New Hire backend contract to support targetRole without changing UI.
```

Bad task:

```text
Improve New Hire completely.
```

Good task:

```text
Redesign the Champ Branch Detail page mobile layout only.
```

Bad task:

```text
Make the app look better.
```

## Scope Control

Every task must explicitly say what it will not do.

Examples:

```text
Do not change approval logic.
Do not change Prisma schema.
Do not change frontend.
Do not add Email/OTP.
Do not reintroduce Termination.
Do not redesign unrelated pages.
```

## Behavior Change Policy

Any behavior change must be intentional and documented.

If behavior changes, update:

```text
docs/01_PRODUCT_RULES.md
docs/02_WORKFLOW_RULES.md
docs/04_DATA_MODEL_RULES.md
Relevant UI docs if applicable
```

## Review Gates

A task is not complete until it passes:

```text
1. Scope review
2. Code review
3. Data/security review
4. Verification checks
5. Manual verification where applicable
6. Known risks documented
```

## Agent Final Response Contract

Every coding agent must answer with:

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

## Completion Status Terms

Use only these:

```text
Complete
Complete with known risks
Blocked
Partially complete
Rejected / needs correction
```

Do not say "done" if manual verification or required checks are missing.
