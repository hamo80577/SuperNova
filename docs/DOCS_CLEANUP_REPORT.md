# Documentation Cleanup Report

## Summary

This cleanup pass was conservative. No files were deleted or moved to archive.

The repository currently keeps important access-control planning, audit, stabilization, and regression reports under `docs/access-control/`. Those reports are historical records for Phases 7 through 9 and should stay available until the project explicitly adopts a broader documentation archive policy.

## Files Kept

Kept as active project guidance:

- `README.md`
- `AGENTS.md`
- `docs/REPO_INDEX.md`
- `docs/00_PROJECT_OPERATING_SYSTEM.md`
- `docs/01_PRODUCT_RULES.md`
- `docs/02_WORKFLOW_RULES.md`
- `docs/03_ARCHITECTURE_RULES.md`
- `docs/04_DATA_MODEL_RULES.md`
- `docs/05_SECURITY_AND_PRIVACY_RULES.md`
- `docs/06_UI_UX_SYSTEM.md`
- `docs/07_VERIFICATION_AND_TESTING.md`
- `docs/08_CODE_QUALITY_RULES.md`
- `docs/09_AGENT_PROMPT_RULES.md`
- `docs/10_REVIEW_CHECKLISTS.md`
- `docs/templates/*`

Kept as historical access-control records:

- `docs/access-control/ACCESS_CONTROL_AUDIT.md`
- `docs/access-control/ACCESS_CONTROL_BRANCH_DEEP_REVIEW.md`
- `docs/access-control/ACCESS_CONTROL_V1.md`
- `docs/access-control/AGENT_BRIEF.md`
- `docs/access-control/IMPLEMENTATION_PLAN.md`
- `docs/access-control/PHASE_7_STABILIZATION_REPORT.md`
- `docs/access-control/PHASE_7A_SCHEMA_DESIGN.md`
- `docs/access-control/PHASE_7G_USER_ACCESS_ROLE_ASSIGNMENT_RULES.md`
- `docs/access-control/PHASE_7I_CUSTOM_ROLE_ASSIGNMENT_API_DESIGN.md`
- `docs/access-control/PHASE_7N_FINAL_STABILIZATION_REPORT.md`
- `docs/access-control/PHASE_8A_LEGACY_ROLE_AUTHORIZATION_INVENTORY.md`
- `docs/access-control/PHASE_8E_AUTHORIZATION_MIGRATION_STABILIZATION.md`
- `docs/access-control/PHASE_9_FULL_REGRESSION_REPORT.md`
- `docs/access-control/README.md`

## Files Moved to Archive

None.

Reason:

- No existing `docs/archive/` convention was present.
- Access-control phase documents are still useful audit and implementation history.
- Moving them now would create churn without improving current HR Sync planning.

## Files Deleted

None.

Reason:

- No file was clearly safe to delete.
- Stale but historically important docs were left in place.

## Missing Requested Legacy Docs

These requested files were not present:

- `docs/CURRENT_PRODUCT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOWS.md`
- `docs/TECHNICAL_GUARDRAILS.md`

The repository currently uses numbered equivalents:

- `docs/01_PRODUCT_RULES.md`
- `docs/02_WORKFLOW_RULES.md`
- `docs/03_ARCHITECTURE_RULES.md`
- `docs/07_VERIFICATION_AND_TESTING.md`

## Cleanup Decision

Cleanup is deferred beyond map and status updates. The next documentation cleanup should decide whether to:

- Keep access-control phase docs in place permanently.
- Create `docs/archive/access-control/`.
- Replace old README doc links with numbered docs only.
- Add a formal "historical reports" section to `docs/REPO_INDEX.md`.
