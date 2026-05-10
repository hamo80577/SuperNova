# MVP Release Review — SuperNova

## MVP Status

The SuperNova MVP core is complete.

Completed areas:

```text
Auth
Roles
Chains
Vendors/Branches
Assignments
Role workspaces
Requests
Approvals
Notifications
Audit logs
New Hire
Profile Completion
Resignation/Termination
Transfer
Admin controls
Reports
Hardening baseline
```

## Current Release Position

The system is functionally ready for MVP release review.

The biggest remaining product issue is UI/UX quality.

Current workstream:

```text
Page-by-page UI/UX redesign
```

## Release-Ready Core Rules

The MVP must preserve:

- Branch-first Champ operations.
- Assignment-derived hierarchy.
- Workflow-based lifecycle changes.
- Admin finalization for New Hire and Offboarding.
- Same-chain/cross-chain Transfer rules.
- Auditability.
- Role-scoped visibility.
- No direct lifecycle bypass.

## Known Risks

### Technical

- `requests.service.ts` is large.
- Automated tests are limited.
- Production Docker image/CI pipeline needs a dedicated pass.
- Moderate dependency audit warnings may remain.
- Dev database may contain accumulated verification data.

### Product/UI

- UI/UX needs redesign page by page.
- Some pages still feel like implementation screens, not product screens.
- Request detail and Champ Branch workspace need strong redesign.
- Admin dashboard needs stronger control-center layout.
- Forms need better review/step structure.

## MVP Demo Cleanup Checklist

Before a serious demo:

- Reset local/demo database if needed.
- Seed clean demo data.
- Create one clean example for each role.
- Create one clean Branch/Chain structure.
- Verify one New Hire.
- Verify one Transfer.
- Verify one Offboarding.
- Verify Admin pending actions.
- Verify reports.
- Remove old verification noise where practical.

## Production Readiness Checklist

Before production deployment:

- Confirm production environment variables.
- Confirm PostgreSQL backup plan.
- Confirm migration process.
- Confirm health checks.
- Confirm HTTPS/Cloudflare routing.
- Confirm no secrets in git.
- Confirm seed strategy.
- Confirm admin bootstrap process.
- Confirm audit log access.
- Confirm blocked/deactivated login behavior.
- Confirm workflow regression.

## UI/UX Release Checklist

For each redesigned page:

```text
Screenshot before
UI/UX audit
Redesign implementation
Verification tier from AGENTS.md / TECHNICAL_GUARDRAILS.md
Screenshot after
Product owner approval
```

Do not move page forward without visual approval.

For normal UI-only redesign, use the web typecheck/lint tier and reserve web build for structural changes or final page acceptance. Do not run Docker/PostgreSQL verification unless backend/full-stack files or behavior changed.

## Recommended Next Steps

1. Replace old phase docs with current-state docs.
2. Redesign Login page.
3. Redesign Admin dashboard.
4. Redesign Champ Branch detail.
5. Redesign Request detail.
6. Polish workflow forms.
7. Prepare clean demo database.
8. Prepare VPS deployment pass.
