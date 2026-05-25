# Planning Reset

## Decision

The previous next-workstream implementation direction is rejected.

Do not merge or continue the rejected branch result.

The project is now back in planning and product-thinking mode before any new implementation work.

## Current Working Branch

Use a clean branch created from `main`.

Current clean branch:

```text
feature/attendance-analytics-clean-v2
```

This branch starts from `main` and should be treated as a clean planning baseline.

## What This Means

Agents and developers must not assume that any previous plan is still approved.

Before implementing anything new:

```text
1. Inspect the current repo.
2. Confirm the product problem.
3. Propose options.
4. Agree on the direction.
5. Break the work into small scoped phases.
6. Implement only the approved phase.
```

## Product Baseline

SuperNova remains:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is a Talabat-style Partner Workforce Operations System, not a generic HR ERP.

## Preserved Rules

Keep these rules active:

```text
Use assignment tables as operational source of truth.
Keep sensitive lifecycle changes workflow-based.
Work page by page for UI/UX.
Avoid broad rewrites.
Avoid unrelated modules.
Do not add microservices.
```

## Rejected-Branch Rule

Old branch work may be read only for context if explicitly requested by the product owner.

It must not be copied, merged, or used as implementation authority.

## Next Step

Start with product planning, not code.

The next planning session should answer:

```text
What problem are we solving next?
Is it core workflow polish, UI/UX, attendance/reporting, integration, or access-control cleanup?
What is the smallest safe first phase?
What should stay out of scope?
```
