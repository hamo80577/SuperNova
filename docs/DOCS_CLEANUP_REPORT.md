# Documentation Cleanup Report

## Summary

This cleanup pass aligned the repository documentation with the approved Attendance Analytics workstream.

No source code, Prisma schema, migrations, API modules, UI routes, package files, or runtime behavior were changed.

## Archive Decision

Existing docs were copied into:

```text
docs/archive/pre-attendance-analytics/
```

They were copied instead of moved because the existing numbered docs, access-control records, HR Sync plan, templates, and repo index remain useful historical references and some repository links still point to their original locations.

## Current Docs Added

The current documentation set now includes:

```text
docs/CURRENT_PRODUCT_STATE.md
docs/PRODUCT_SCOPE_AND_GUARDRAILS.md
docs/DOMAIN_MODEL_AND_ASSIGNMENTS.md
docs/WORKFLOWS_AND_APPROVAL_RULES.md
docs/ACCESS_CONTROL_AND_PERMISSIONS.md
docs/REPORTS_AND_ROLE_WORKSPACES.md
docs/UI_UX_DIRECTION.md
docs/UI_UX_COMPONENT_RULES.md
docs/ATTENDANCE_MODULE_SPEC.md
docs/ATTENDANCE_DATA_MODEL.md
docs/ATTENDANCE_OPERATIONS_UI.md
docs/ATTENDANCE_CALCULATION_RULES.md
docs/ATTENDANCE_IMPLEMENTATION_PLAN.md
docs/CODEX_WORKFLOW_RULES.md
```

## Files Kept In Place

Historical docs remain in place for compatibility and audit context:

```text
docs/00_PROJECT_OPERATING_SYSTEM.md
docs/01_PRODUCT_RULES.md
docs/02_WORKFLOW_RULES.md
docs/03_ARCHITECTURE_RULES.md
docs/04_DATA_MODEL_RULES.md
docs/05_SECURITY_AND_PRIVACY_RULES.md
docs/06_UI_UX_SYSTEM.md
docs/07_VERIFICATION_AND_TESTING.md
docs/08_CODE_QUALITY_RULES.md
docs/09_AGENT_PROMPT_RULES.md
docs/10_REVIEW_CHECKLISTS.md
docs/access-control/*
docs/integrations/HR_GOOGLE_SHEETS_SYNC_PLAN.md
docs/templates/*
```

## Product Decisions Captured

The new docs capture:

```text
SuperNova is a Partner Workforce Operations System, not a generic HR ERP.
The architecture remains a modular monolith.
Operational hierarchy source of truth remains assignment tables.
Lifecycle changes remain Request -> Approval -> System applies change.
Attendance Analytics is approved only for import, calculations, summaries, scoped reports, and Super Admin data operations.
Attendance imports must never mutate users, assignments, roles, identifiers, employment status, or account status.
Uploaded attendance files must not be permanently stored.
Older attendance months must compress daily detail into monthly summaries.
```

## Files Deleted

None.
