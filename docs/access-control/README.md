# Access Control V1

This is the lean planning pack for the SuperNova Access Control V1 workstream.

Use this folder to guide Codex/Claude before writing implementation code.

## Goal

Move SuperNova from hardcoded role decisions toward a scalable access model:

```text
Role-based UX
Permission-based backend decisions
Assignment-based scope
Workflow-based lifecycle changes
```

## Branch

Work on a dedicated branch:

```bash
git checkout -b feature/access-control-v1
```

## Read Order

1. `ACCESS_CONTROL_V1.md`
2. `IMPLEMENTATION_PLAN.md`
3. `AGENT_BRIEF.md`

## Rule

These docs are direction, not implementation law.

The agent must inspect the repo first and may refine the plan if the code proves a better safe path.

Do not implement database migrations, custom roles UI, or workflow refactors before the early foundation phases are complete.
