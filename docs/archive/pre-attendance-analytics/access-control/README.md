# Access Control V1

This folder is the historical planning, audit, stabilization, and regression record for SuperNova Access Control V1 and the Phase 8 policy authorization migration.

Access Control V1 is backend-complete and merged to `main`.

## Goal

The completed work moved SuperNova from hardcoded role decisions toward a scalable access model:

```text
Role-based UX
Permission-based backend decisions
Assignment-based scope
Workflow-based lifecycle changes
```

## Read Order

For history and future audits:

1. `ACCESS_CONTROL_AUDIT.md`
2. `ACCESS_CONTROL_V1.md`
3. `IMPLEMENTATION_PLAN.md`
4. `AGENT_BRIEF.md`
5. `PHASE_7N_FINAL_STABILIZATION_REPORT.md`
6. `PHASE_8A_LEGACY_ROLE_AUTHORIZATION_INVENTORY.md`
7. `PHASE_8E_AUTHORIZATION_MIGRATION_STABILIZATION.md`
8. `PHASE_9_FULL_REGRESSION_REPORT.md`

## Rule

These docs are historical guidance and audit records, not a live implementation prompt.

Future changes must inspect the current code first and preserve these product rules:

```text
User.role remains primary persona/workspace.
Operational scope remains assignment-table based.
Lifecycle changes remain workflow-based.
Custom roles are additive permission grants only.
```
