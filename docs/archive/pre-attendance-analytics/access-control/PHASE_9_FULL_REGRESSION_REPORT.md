# Phase 9 Full Regression Report

## Executive Verdict

Merge-ready

Phase 9 completed a full regression, security verification, startup smoke, workflow verification, database/seed verification, and merge-readiness audit for `feature/policy-authorization-v1`. No critical or high findings were found. The branch is ready to merge after the Phase 9 report is reviewed.

## Overall Scores

| Area | Score |
| --- | ---: |
| Authorization safety | 9/10 |
| Workflow safety | 10/10 |
| Permission model | 9/10 |
| Persona/workspace safety | 10/10 |
| Database/seed safety | 10/10 |
| Test coverage | 9/10 |
| Build/startup reliability | 10/10 |
| Maintainability | 8/10 |
| Merge readiness | 9/10 |

## Branch Diff Summary

Baseline: `main...HEAD`.

Changed areas:

| Area | Status |
| --- | --- |
| `apps/api/src/access-control` | Expected Phase 8 changes: `PermissionGuard`, `@RequirePermission`, access-control route migration, pending approval permission key/matrix update. |
| `apps/api/src/users/users.controller.ts` | Expected Phase 8 route migration for self/read-only and user custom access-role assignment routes. |
| `apps/api/src/notifications/notifications.controller.ts` | Expected Phase 8 notification route migration. |
| `apps/api/src/approvals/approvals.controller.ts` | Expected Phase 8 pending approvals migration. |
| `apps/api/src/requests/requests.controller.ts` | Expected Phase 8D helper route policy checks only. |
| `apps/api/test/*access-control*`, policy tests | Expected test updates. |
| `docs/access-control/PHASE_8A_LEGACY_ROLE_AUTHORIZATION_INVENTORY.md` | Expected Phase 8A audit document. |
| `docs/access-control/PHASE_8E_AUTHORIZATION_MIGRATION_STABILIZATION.md` | Expected Phase 8E stabilization document. |

Forbidden/unchanged areas verified:

| Area | Result |
| --- | --- |
| `prisma` | No changes. |
| `apps/web` | No changes. |
| `apps/api/src/requests/workflows` | No changes. |
| `apps/api/src/requests/request-approval-routing.service.ts` | No changes. |
| `apps/api/src/reports` | No changes. |
| `apps/api/src/workspaces` | No changes. |
| `apps/api/src/admin` | No changes. |
| `apps/api/src/assignments` | No changes. |

## Authorization Model Verification

Pass.

Evidence:

- `PermissionGuard` reads `REQUIRED_PERMISSION_KEY` metadata from handler/class.
- `PermissionGuard` calls `AccessPolicyService.assertCan(request.user, requiredPermission)`.
- `PermissionGuard` does not query Prisma or read DB state directly.
- `AccessPolicyService.hasPermission`, `can`, and `assertCan` remain synchronous.
- Static migrated routes use `JwtAuthGuard + PermissionGuard + @RequirePermission`.
- Request helper routes use dynamic `accessPolicy.assertCan(...)` based on `targetRole` and keep `RolesGuard`.
- Remaining `@Roles` usages are in persona/workspace, report, finalization, admin/assignment, organization, or other explicitly deferred hybrid routes.
- Custom role management permissions remain Super Admin-only in the matrix.
- Access-control management permissions remain `systemOnly: true` and `assignable: false`.
- Custom role grants remain additive and are filtered by service/workflow scope checks downstream.

## Migrated Route Verification

Pass.

Verified migrated route groups:

| Controller | Route group | Verification |
| --- | --- | --- |
| `AccessControlController` | Overview, role list/read/create/update/deactivate/sync, effective permissions | Uses `@RequirePermission` and `PermissionGuard`; no manual route-level static assert remains. |
| `NotificationsController` | List, mark read, mark all read | Uses notification permission keys through `PermissionGuard`; service calls still use `user.id`. |
| `UsersController` | `me`, preferences, operational profile | Uses user self/read-only permission keys through `PermissionGuard`; service target/scope checks remain. |
| `UsersController` | Custom access-role assignment list/assign/revoke | Uses Super Admin-only system permission keys through `PermissionGuard`; assignment service validation/audit/cache refresh remains. |
| `ApprovalsController` | Pending approvals | Uses `APPROVALS_VIEW_PENDING`; approve/reject remain service-authority based. |
| `RequestsController` | Offboarding picker search, eligible-user search, New Hire candidate lookup | Uses dynamic target-role policy checks while retaining `@Roles`. |

## Remaining Hybrid / Persona Routes Verification

Pass.

Remaining `@Roles` count: 30.

Retained intentionally:

- Workspaces routes: persona/workspace responses assume `User.role`.
- Reports routes: report scope and response shape are role/persona specific.
- Picker profile completion: Picker-only workflow surface.
- Request helper routes: workflow-adjacent and target-role sensitive, with policy checks added in Phase 8D.
- Request finalization routes: final lifecycle mutation remains Admin/Super Admin hybrid.
- Users list/admin profile/Area Manager chain assignment routes: admin-shaped or assignment-sensitive.
- Admin, Assignments, Chains, Vendors route groups: deferred for separate organization/assignment authorization phases.

No persona/workspace route was converted to custom-permission-only access.

## Workflow Regression Verification

Pass.

Verified no behavior changes for:

- New Hire policy rules.
- New Hire approval routing.
- New Hire approval behavior.
- Rehire behavior.
- Offboarding/resignation policy.
- Offboarding approval/finalization.
- Offboarding payload validation.
- Transfer workflow.
- Approval approve/reject authority and ownership/current-step checks.
- Request visibility, submit, cancel, helper lookup/search policy tests.
- Area Manager chain assignment safety.
- Temporary password route policy and service-level target/scope checks through users policy regression tests.
- Picker profile-completion role/persona retention through users policy regression tests.

No request workflow service or approval routing file changed in the branch diff.

## Database / Seed Verification

Pass.

Commands:

- `npm run prisma:validate`: passed.
- `npm run prisma:generate`: passed.
- `npm run db:seed`: passed.
- `npm run db:seed`: passed again with the same system role/permission counts.

Seed output on both runs:

- `Synced system access roles from permission matrix: 5 roles, 107 permissions.`
- Real organization seed remained stable: `9 Chains and 204 Branches`.

Direct DB verification after the second seed:

| Check | Result |
| --- | ---: |
| SYSTEM access roles | 5 |
| CUSTOM access roles | 0 |
| UserAccessRoleAssignment rows | 0 |
| SYSTEM AccessRolePermission rows | 107 |
| Expected code-matrix permission rows | 107 |
| Duplicate SYSTEM role/permission pairs | 0 |

Per-role DB mirror counts:

| System role | Expected | DB | `APPROVALS_VIEW_PENDING` |
| --- | ---: | ---: | --- |
| `PICKER` | 6 | 6 | No |
| `CHAMP` | 11 | 11 | No |
| `AREA_MANAGER` | 15 | 15 | Yes |
| `ADMIN` | 31 | 31 | Yes |
| `SUPER_ADMIN` | 44 | 44 | Yes |

## Dev Startup / Smoke Verification

Pass.

Pre-start:

- Existing repo listener on port `4000` was stopped.
- Ports `3000` and `4000` were confirmed free before startup.

Startup:

- `npm run dev` started API without Nest dependency errors.
- `npm run dev` started web.
- No `EADDRINUSE`, Nest dependency resolution, unhandled exception, or startup error pattern appeared in the dev log.

Endpoint checks:

| Check | Result |
| --- | --- |
| `GET http://localhost:4000/api/health` | `200` |
| `GET http://localhost:3000/login` | `200` |
| Unauthenticated `GET /api/access-control/overview` | `401` |
| Unauthenticated `GET /api/access-control/roles` | `401` |
| Unauthenticated `GET /api/notifications` | `401` |
| Unauthenticated `PATCH /api/notifications/read-all` | `401` |
| Unauthenticated `GET /api/users/me` | `401` |
| Unauthenticated `GET /api/users/some-id/operational-profile` | `401` |
| Unauthenticated `GET /api/users/some-id/access-role-assignments` | `401` |
| Unauthenticated `GET /api/approvals/pending` | `401` |
| Unauthenticated `GET /api/requests` | `401` |
| Unauthenticated `GET /api/requests/offboarding/pickers` | `401` |
| Unauthenticated `POST /api/requests/new-hire/lookup-candidate` | `401` |
| Unauthenticated `GET /api/reports/admin/overview` | `401` |
| Unauthenticated `GET /api/workspaces/admin` | `401` |

Post-smoke:

- Dev processes were stopped.
- Ports `3000` and `4000` were confirmed free.

## Security Findings

### Critical

None.

### High

None.

### Medium

| File | Function/route | Issue | Risk | Recommended action | Blocker status |
| --- | --- | --- | --- | --- | --- |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests` / `create` | Generic request create remains authenticated-only and has no route-level permission key. | A future non-active request type could be created without an explicit policy gate if service restrictions are expanded later. Current service rejects New Hire, Resignation, and Transfer and blocks Pickers, so active lifecycle workflows are not bypassed. | In a later scoped phase, either deprecate this endpoint or add an explicit generic-create permission/product decision. | Not a merge blocker; pre-existing/deferred from Phase 8A and not introduced by Phase 8 route migrations. |

### Low

| File | Function/route | Issue | Risk | Recommended action | Blocker status |
| --- | --- | --- | --- | --- | --- |
| `apps/api/test/*access-policy*.test.ts` | Direct controller/service tests | Many policy tests inspect metadata or call controllers/services directly rather than full HTTP guard ordering. | Good unit confidence, but limited end-to-end auth proof for every route group. | Add HTTP-level auth regression coverage in a future test hardening phase. | Not a blocker; dev smoke and focused tests passed. |
| `apps/api/src/access-control/access-policy.service.ts` | Startup/custom assignment caches | Permission caches are process-local. | Multi-process deployments still need cache invalidation discipline after mutations. | Keep documented restart/refresh expectations; revisit distributed invalidation only if deployment topology requires it. | Not a blocker; existing behavior from Phase 7. |
| `apps/api/src/admin`, `apps/api/src/assignments`, `apps/api/src/chains`, `apps/api/src/vendors` | Deferred route groups | These remain `@Roles`/hybrid and not policy-migrated. | Legacy role perimeter remains in place for some admin/organization areas. | Migrate route-by-route in later scoped phases after service scope review. | Not a blocker; intentionally out of Phase 8 scope. |

## Tests / Checks Run

| Command | Result |
| --- | --- |
| `git status --short` | Clean before Phase 9 report creation. |
| `git diff --stat main...HEAD` | Expected Phase 8 docs/auth/test/controller diff only. |
| `git diff --name-status main...HEAD` | Expected Phase 8 files only. |
| `git diff main...HEAD -- prisma` | No output. |
| `git diff main...HEAD -- apps/web` | No output. |
| `git diff main...HEAD -- apps/api/src/requests/workflows` | No output. |
| `git diff main...HEAD -- apps/api/src/requests/request-approval-routing.service.ts` | No output. |
| `git diff main...HEAD -- apps/api/src/reports` | No output. |
| `git diff main...HEAD -- apps/api/src/workspaces` | No output. |
| `git diff main...HEAD -- apps/api/src/admin` | No output. |
| `git diff main...HEAD -- apps/api/src/assignments` | No output. |
| `rg "@Roles\\(" apps/api/src` | 30 expected retained role decorators. |
| `rg "RolesGuard" apps/api/src` | Expected retained imports/usages plus guard/module definitions. |
| `rg "@RequirePermission" apps/api/src` | 18 migrated static route permissions. |
| `rg "PermissionGuard" apps/api/src` | Expected migrated route/module usages. |
| `npm run prisma:validate` | Passed. |
| `npm run prisma:generate` | Passed. |
| `npm run db:seed` | Passed. |
| `npm run db:seed` | Passed again, same role/permission count. |
| DB verification script via `npx tsx -e` | Passed; 5 system roles, 107 system permissions, 0 duplicates. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permission.guard.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-overview.controller.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-custom-roles.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-user-assignments.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-policy.service.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permissions.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-role-permission-matrix.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-system-role-seed.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-approval-authority.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/notifications-access-policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-access-policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/approvals-access-policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/requests-access-policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/reports-access-policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.policy.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-payload.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-area-manager-chain-assignments.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-list-filters.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-admin-profile.dto.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/env-validation.test.ts` | Passed. |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-logger.middleware.test.ts` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run build` | Passed. |
| `git diff --check` | Passed before Phase 9 report creation. |

All listed test files existed.

## Manual Browser Smoke

Partially completed.

- `GET http://localhost:3000/login` returned `200`, proving the login page loads through the running web app.
- Authenticated browser smoke for Super Admin Access Control, Champ workspace, Area Manager workspace, New Hire request flow, approvals pending page, notifications page, and `users/me` was not completed because no interactive test credentials were provided in this phase.

## Required Fixes Before Merge

None.

## Can Defer After Merge

- Decide whether to deprecate `POST /api/requests` or add an explicit generic request creation permission.
- Add HTTP-level authorization regression tests for migrated route groups.
- Plan a separate route-by-route policy coverage phase for Admin, Assignments, Chains, Vendors, and other organization surfaces.
- Revisit process-local permission cache invalidation if deployment scales to multiple API processes.

## Final Recommendation

Merge `feature/policy-authorization-v1` into `main`.

The branch preserves SuperNova product rules: `User.role` remains the persona/workspace field, operational scope remains assignment-table based, and lifecycle mutations still require Request -> Approval -> System-applied changes. The remaining `@Roles` usage is intentional and documented for future scoped phases.
