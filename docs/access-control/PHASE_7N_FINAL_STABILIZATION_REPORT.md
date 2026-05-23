# Phase 7N Final Stabilization Report

## Executive Verdict

Merge-ready after minor cleanup

Phase 7 is functionally complete and the requested regression, build, seed, and startup checks passed. The branch preserves SuperNova's workforce-operations model: `User.role` still drives persona/workspace, operational scope still comes from assignment tables, and lifecycle mutations still go through Request -> Approval -> System applies change.

No critical or high security blocker was found. The branch should still take a short cleanup pass before merge to harden service-level validation, make the read-only frontend source labeling match the backend overview response, and explicitly document or handle post-transaction cache-refresh failure semantics.

## Phase 7N.1 Cleanup Status

Completed after this report was first written:

- `AccessRoleService` now defensively validates custom-role `permissionKeys` at the service boundary.
- The read-only Access Control overview page now displays the backend system-role matrix source note.
- Custom role and user access-role assignment mutation services now surface explicit cache-refresh failure errors after committed mutations.
- Custom role assignment now requires both active account status and active employment status.

## Overall Scores

- Architecture: 8/10
- Security: 8/10
- Workflow safety: 9/10
- Permission model: 8/10
- Database/migrations: 9/10
- API safety: 8/10
- Test coverage: 8/10
- Maintainability: 7/10
- Product fit: 9/10

## Final Scope Summary

Phase 7 added the backend foundation for DB-backed access roles and custom role management:

- `AccessRole`, `AccessRolePermission`, and `UserAccessRoleAssignment` schema foundation.
- Active-only partial unique index for user/access-role assignments.
- Idempotent SYSTEM role seed/sync from `SYSTEM_ROLE_PERMISSIONS`.
- `AccessPolicyService` DB-backed SYSTEM cache with code-matrix fallback.
- ACTIVE CUSTOM assignment additive grants with unknown/system-only/non-assignable permission rejection.
- `refreshPermissionCaches()`.
- Super Admin-only custom role management API.
- Super Admin-only user custom-role assignment/revoke API.
- Super Admin-only effective-permissions read endpoint.
- Read-only Super Admin access-control overview page.

No custom-role frontend UI was added. No workflow services, approval routing, operational assignment services, `User.role`, or `RequestApproval.approverRole` were replaced.

## Product Rule Verification

Pass.

Evidence:

- `prisma/schema.prisma` keeps `User.role` and adds access-role tables separately.
- `prisma/schema.prisma` keeps `RequestApproval.approverRole`.
- `apps/api/src/access-control/access-role-assignment.service.ts:90` creates user access-role assignments without mutating `User.role`.
- `apps/api/src/access-control/access-role-assignment.service.ts:299` computes effective permissions only; it does not create operational scope.
- `apps/api/src/requests/workflows/**`, `apps/api/src/requests/request-approval-routing.service.ts`, and `apps/api/src/assignments/**` were not changed by Phase 7.
- Workflow regression tests passed.

AccessRole/UserAccessRoleAssignment is additive permission infrastructure only. It does not promote Picker to Champ and does not create Chain, Branch, Picker, Champ, or Area Manager scope.

## Permission Model Verification

Pass.

Evidence:

- Custom role management keys are defined in `apps/api/src/access-control/permissions.ts:83`.
- These keys are Super Admin-only in `apps/api/src/access-control/role-permission.matrix.ts:91`.
- Their definitions are `systemOnly: true` and `assignable: false` in `apps/api/src/access-control/permissions.ts:439`.
- `AccessRoleService.validateCustomRolePermissionKeys()` rejects unknown, system-only, non-assignable, and duplicate permission keys at `apps/api/src/access-control/access-role.service.ts:465`.
- `AccessPolicyService.buildValidatedDbUserAccessRolePermissionCache()` rejects unknown, system-only, and non-assignable CUSTOM grants at `apps/api/src/access-control/access-policy.service.ts:261`.
- `AccessPolicyService.hasPermission()` checks base role permissions first, then additive user grants at `apps/api/src/access-control/access-policy.service.ts:80`.

Custom grants are additive only. Base `User.role` permissions are not removed by custom assignments.

## Workflow Safety Verification

Pass.

Evidence:

- Request controller policy gates call service methods, but the service/workflow layers remain authoritative for status, scope, and lifecycle safety.
- Approval decision policy gates in `apps/api/src/approvals/approvals.service.ts:381` run before decision continuation but do not replace `assertCanDecide()` at `apps/api/src/approvals/approvals.service.ts:350`.
- New Hire, Offboarding/Resignation, Transfer, finalization, and approval regression tests all passed.
- No Phase 7 diff under `apps/api/src/requests/workflows/**`, `apps/api/src/requests/request-approval-routing.service.ts`, or `apps/api/src/assignments/**`.

No direct Picker creation, transfer, archive/deactivation, or active assignment edit path was introduced by access-control work.

## Custom Role API Verification

Pass with minor service-validation cleanup recommended.

Evidence:

- Access Control routes are class-level Super Admin-only in `apps/api/src/access-control/access-control.controller.ts:45`.
- List/read routes assert `ACCESS_CONTROL_VIEW_CUSTOM_ROLES` at `apps/api/src/access-control/access-control.controller.ts:76` and `apps/api/src/access-control/access-control.controller.ts:103`.
- Create/update/deactivate/sync routes assert `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` at `apps/api/src/access-control/access-control.controller.ts:116`, `:134`, `:152`, and `:170`.
- SYSTEM roles cannot be mutated through `findCustomRoleOrThrow()` in `apps/api/src/access-control/access-role.service.ts:444`.
- `system.*` keys are blocked in `apps/api/src/access-control/access-role.service.ts:502`.
- Create forces CUSTOM/isSystem false/systemRole null/status ACTIVE in `apps/api/src/access-control/access-role.service.ts:106`.
- Audit is written for create/update/deactivate/sync in `apps/api/src/access-control/access-role.service.ts:126`, `:201`, `:273`, and `:356`.
- Cache refresh runs after successful mutations in `apps/api/src/access-control/access-role.service.ts:164`, `:228`, `:302`, and `:390`.

Concern:

- `apps/api/src/access-control/access-role.service.ts:317` passes `dto.permissionKeys` directly into `validateCustomRolePermissionKeys()`, which assumes an array at `:468`. HTTP requests are protected by the global `ValidationPipe` in `apps/api/src/main.ts:34`, but a direct malformed service call can still throw a raw `TypeError` rather than `BadRequestException`.

Recommended action:

- Add service-level defensive array validation in `validateCustomRolePermissionKeys()` before merge.

## User Assignment API Verification

Pass with minor product-state validation cleanup recommended.

Evidence:

- User assignment routes are Super Admin-only in `apps/api/src/users/users.controller.ts:120`, `:135`, and `:160`.
- List asserts `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` at `apps/api/src/users/users.controller.ts:126`.
- Assign asserts `ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES` at `apps/api/src/users/users.controller.ts:143`.
- Revoke asserts `ACCESS_CONTROL_REVOKE_CUSTOM_ROLES` at `apps/api/src/users/users.controller.ts:169`.
- Assign blocks inactive account users at `apps/api/src/access-control/access-role-assignment.service.ts:101`.
- Assign blocks SYSTEM or inactive CUSTOM roles through `assertAssignableCustomAccessRole()` at `apps/api/src/access-control/access-role-assignment.service.ts:467`.
- Duplicate active assignment is pre-checked at `apps/api/src/access-control/access-role-assignment.service.ts:123` and backed by the partial unique index in `prisma/migrations/20260522162758_add_active_user_access_role_assignment_unique_index/migration.sql`.
- Revoke marks assignment INACTIVE and sets `endsAt` at `apps/api/src/access-control/access-role-assignment.service.ts:246`.
- Assign/revoke write audit and refresh caches at `apps/api/src/access-control/access-role-assignment.service.ts:154`, `:182`, `:260`, and `:294`.

Concern:

- Assign checks `accountStatus === ACTIVE` but does not also check `employmentStatus === ACTIVE` at `apps/api/src/access-control/access-role-assignment.service.ts:101`. If the product considers resigned/archived employment status ineligible for access-role grants even when accountStatus is ACTIVE, this should be tightened or explicitly documented.

Recommended action:

- Clarify target-user eligibility and add an employment-status guard if product intent is "account and employment active."

## Effective Permissions Verification

Pass with reporting polish recommended.

Evidence:

- Effective permissions route is Super Admin-only via `AccessControlController`.
- It asserts `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` at `apps/api/src/access-control/access-control.controller.ts:89`.
- Base role permissions come from `getPermissionsForRole()` at `apps/api/src/access-control/access-role-assignment.service.ts:354`.
- Active current CUSTOM assignments are filtered at `apps/api/src/access-control/access-role-assignment.service.ts:306`.
- Inactive/expired/future assignments, SYSTEM roles, inactive custom roles, unknown permissions, system-only permissions, and non-assignable permissions are ignored/warned at `apps/api/src/access-control/access-role-assignment.service.ts:369`.
- Effective-permissions view audit is written at `apps/api/src/access-control/access-role-assignment.service.ts:436`.

Concern:

- The endpoint warning array currently reports invalid custom permission rows, but it does not always include static warnings that cache data is startup/refresh loaded or that SYSTEM DB rows are code-owned mirrors. This is not an authorization bug, but it weakens the explanatory value of the endpoint.

Recommended action:

- Add stable informational warnings or metadata before building a UI around this endpoint.

## Database / Migration Verification

Pass.

Evidence:

- `20260522111246_add_access_roles` only creates access-role enum/table/permission structures.
- `20260522121209_add_user_access_role_assignments` only creates `UserAccessRoleAssignment`, indexes, and FKs.
- `20260522162758_add_active_user_access_role_assignment_unique_index` only creates a partial unique index for ACTIVE assignments.
- No destructive SQL operations were found.
- No Permission table, Tenant/Country tables, or user chain/vendor/manager source-of-truth fields were added.
- `User.role` and `RequestApproval.approverRole` remain intact.

The partial unique index allows one ACTIVE row per user/accessRole pair while preserving multiple INACTIVE historical rows.

## Seed / DB Mirror Verification

Pass.

Commands:

- `npm run db:seed`
- `npm run db:seed`

Both seed runs passed and reported:

```text
Synced system access roles from permission matrix: 5 roles, 104 permissions.
```

DB verification after seeding:

| Role | Expected | Actual |
| --- | ---: | ---: |
| PICKER | 6 | 6 |
| CHAMP | 11 | 11 |
| AREA_MANAGER | 14 | 14 |
| ADMIN | 30 | 30 |
| SUPER_ADMIN | 43 | 43 |

Additional DB checks:

- SYSTEM AccessRole rows: 5
- CUSTOM AccessRole rows: 0
- UserAccessRoleAssignment rows: 0
- Duplicate AccessRolePermission pairs: 0

SYSTEM DB rows are code-owned mirrors of `SYSTEM_ROLE_PERMISSIONS`.

## Cache / Refresh Verification

Pass with known post-commit refresh-failure risk.

Evidence:

- `hasPermission`, `can`, and `assertCan` are synchronous at `apps/api/src/access-control/access-policy.service.ts:80`, `:104`, and `:112`.
- `refreshPermissionCaches()` is async and concurrency guarded at `apps/api/src/access-control/access-policy.service.ts:61`.
- `onModuleInit()` calls the refresh path at `apps/api/src/access-control/access-policy.service.ts:57`.
- DB SYSTEM fallback resets to code matrix on invalid/incomplete DB cache at `apps/api/src/access-control/access-policy.service.ts:122`.
- CUSTOM assignment cache fallback ignores custom grants on invalid data at `apps/api/src/access-control/access-policy.service.ts:159`.
- `access-control-policy.service.test.ts` covers no-Prisma fallback, empty DB fallback, missing SYSTEM role fallback, unknown SYSTEM permission fallback, valid DB cache, valid CUSTOM grants, invalid CUSTOM grant fallback, and refresh concurrency.

Concern:

- `AccessRoleService` and `AccessRoleAssignmentService` call `refreshPermissionCaches()` after transaction commit. If refresh fails unexpectedly, the database mutation remains committed while the process cache may remain stale. The endpoint returns an error, but the persisted state has changed.

Recommended action:

- Before merge or before production rollout, define a documented degraded mode or add retry/explicit warning behavior for post-commit refresh failure.

## Audit Verification

Pass.

Evidence:

- Custom role create/update/deactivate/permission sync audit actions are written in `apps/api/src/access-control/access-role.service.ts`.
- User custom role assign/revoke audit actions are written in `apps/api/src/access-control/access-role-assignment.service.ts`.
- Effective-permissions view audit is written as `USER_EFFECTIVE_PERMISSIONS_VIEWED`.
- Tests assert audit writes for custom role mutations and user assignment/effective-permissions flows.

No role mutation, assignment, revoke, or effective-permissions view path was found without audit.

## Frontend Exposure Verification

Pass for protection and mutation exposure. Partial for source labeling.

Evidence:

- Super Admin page is protected with `allowedRoles={["SUPER_ADMIN"]}` in `apps/web/app/super-admin/access-control/page.tsx:7`.
- Only the Super Admin nav includes Access Control in `apps/web/components/dashboard/role-nav.ts:209` and `:259`.
- No frontend role-management or assignment mutation UI exists.
- Backend overview includes `systemRolePermissionsSource` at `apps/api/src/access-control/access-control.controller.ts:67`.

Concern:

- The frontend API type in `apps/web/lib/api/access-control.ts` does not include `systemRolePermissionsSource`, and the UI text at `apps/web/components/access-control/access-control-overview-page.tsx:113` does not render the code-owned mirror/source note. The backend is clear, but the visible read-only page can still look like the shown matrix is the complete runtime source.

Recommended action:

- Display the source note or include a visible read-only "code-owned mirror" label before merge.

## Module Dependency Verification

Pass with maintainability risk.

Evidence:

- `AccessControlModule` imports `forwardRef(() => UsersModule)` at `apps/api/src/access-control/access-control.module.ts:11`.
- `UsersModule` imports `forwardRef(() => AccessControlModule)` at `apps/api/src/users/users.module.ts:12`.
- Dev startup passed and Nest mapped access-control, users, request, approval, report, and notification routes without dependency errors.

Concern:

- The policy provider, custom role APIs, and guarded overview controller live in one module, while UsersController consumes `AccessRoleAssignmentService` from that module. The forwardRef cycle works today but is fragile.

Recommended action:

- Defer unless it becomes painful, then split a provider-only policy/access-role module from the guarded access-control controller module.

## Security Findings

### Critical

None.

### High

None.

### Medium

1. `apps/api/src/access-control/access-role.service.ts:317` / `syncCustomRolePermissions()`
   - Why it matters: direct malformed service calls can pass `permissionKeys: undefined`, causing `validateCustomRolePermissionKeys()` at `:468` to call `.map()` on a non-array and throw a raw `TypeError`. HTTP is protected by the global ValidationPipe, but service-level behavior is not defensive.
   - Recommended action: add explicit array validation and throw `BadRequestException`.
   - Blocker status: should fix before merge; not a build/startup blocker.

2. `apps/api/src/access-control/access-role.service.ts:164` and `apps/api/src/access-control/access-role-assignment.service.ts:182`
   - Why it matters: cache refresh happens after transaction commit. A refresh failure can leave persisted permission/assignment state while the process cache remains stale until another refresh or restart.
   - Recommended action: add documented degraded-mode behavior, retry, or explicit mutation response warning before production rollout.
   - Blocker status: not a test/startup blocker; should be accepted or cleaned before merge.

3. `apps/web/components/access-control/access-control-overview-page.tsx:113`
   - Why it matters: the visible Super Admin page does not display the backend's code-owned mirror/source note. This can confuse operators once DB-backed caches are involved.
   - Recommended action: display `systemRolePermissionsSource.note` or equivalent static label.
   - Blocker status: should fix before merge as small UI clarity cleanup.

4. `apps/api/src/access-control/access-role-assignment.service.ts:101`
   - Why it matters: assigning a custom role only checks `accountStatus`; if product requires active employment too, resigned/archived users could receive access grants while still account-active.
   - Recommended action: decide eligibility and enforce `employmentStatus === ACTIVE` if intended.
   - Blocker status: product decision; not a build/startup blocker.

### Low

1. `apps/api/src/access-control/access-role-assignment.service.ts:299`
   - Why it matters: effective-permissions warnings only report invalid permission rows and do not always explain cache/source freshness.
   - Recommended action: add stable informational metadata before UI work.
   - Blocker status: deferable.

2. `apps/api/src/access-control/access-control.module.ts:11` and `apps/api/src/users/users.module.ts:12`
   - Why it matters: forwardRef cycle is a maintainability risk as access-control grows.
   - Recommended action: split provider/controller modules later.
   - Blocker status: deferable because startup passes.

3. `apps/api/test/access-control-policy.service.test.ts` and `apps/api/test/access-control-user-assignments.test.ts`
   - Why it matters: tests are heavily mocked and include `as never`, so they can miss real Prisma shape/runtime integration issues.
   - Recommended action: add a thin Nest/e2e or Prisma-backed integration test later.
   - Blocker status: deferable.

## Maintainability Findings

- `AccessPolicyService` is still clean enough, but it now owns permission checks, startup cache loading, validation, fallback behavior, and refresh orchestration. Do not add more responsibilities to it.
- `AccessRoleService` is large because it handles list/read/create/update/deactivate/sync plus validation and audit. It is acceptable for this branch but should not absorb user assignment logic.
- `AccessRoleAssignmentService` correctly isolates user assignment/effective-permissions logic from `AccessPolicyService`.
- `AccessControlModule` and `UsersModule` have a forwardRef cycle. It is acceptable only because startup passes.
- New tests cover substantial behavior but are direct service/controller tests rather than HTTP/Nest integration tests.
- `apps/api/test/requests-access-policy.test.ts:185` still uses `Reflect.construct`, and access-control tests use multiple `as never` casts.

## Tests / Checks Run

Core:

- `npm run prisma:validate` - passed
- `npm run prisma:generate` - passed
- `npm run db:seed` - passed
- `npm run db:seed` - passed
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run build` - passed

Access-control tests:

- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-policy.service.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-custom-roles.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-user-assignments.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-overview.controller.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-system-role-seed.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-role-permission-matrix.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permissions.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-approval-authority.test.ts` - passed

Policy integration tests:

- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-access-policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/requests-access-policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/approvals-access-policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/reports-access-policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/notifications-access-policy.test.ts` - passed

Workflow and related regression tests:

- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.policy.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-payload.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-area-manager-chain-assignments.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-list-filters.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-admin-profile.dto.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/env-validation.test.ts` - passed
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-logger.middleware.test.ts` - passed

All named workflow regression test files existed and were run.

## Dev Startup / Smoke Verification

Before startup:

- Existing listener on port 4000 was stopped.
- Ports 3000 and 4000 were confirmed free.

Startup:

- `npm run dev` started API and web.
- API started without Nest dependency errors.
- Web started.
- No EADDRINUSE duplicate listener noise.

Smoke checks:

- `GET http://localhost:4000/api/health` -> 200
- `GET http://localhost:3000/login` -> 200
- unauthenticated `GET http://localhost:4000/api/access-control/roles` -> 401
- unauthenticated `GET http://localhost:4000/api/users/some-id/access-role-assignments` -> 401
- unauthenticated `GET http://localhost:4000/api/access-control/effective-permissions/users/some-id` -> 401
- unauthenticated `GET http://localhost:4000/api/requests` -> 401
- unauthenticated `GET http://localhost:4000/api/approvals/pending` -> 401

After verification:

- Dev listeners were stopped.
- Ports 3000 and 4000 were confirmed free.

## Required Fixes Before Merge

No open required fixes after the Phase 7N.1 cleanup.

Closed in Phase 7N.1:

- Added service-level defensive validation in `AccessRoleService.validateCustomRolePermissionKeys()` so malformed direct service calls return `BadRequestException` instead of raw `TypeError`.
- Rendered the system-role matrix source note in the read-only frontend overview.
- Added explicit post-transaction cache-refresh failure errors for custom role and user assignment mutations.
- Enforced the stricter target-user eligibility rule: both `accountStatus === ACTIVE` and `employmentStatus === ACTIVE` are required for custom role assignment.

## Can Defer After Merge

- Split access-control provider-only concerns from guarded controller concerns to reduce the forwardRef module cycle.
- Add a thin HTTP/Nest integration test for Super Admin-only access-control routes.
- Add Prisma-backed integration coverage for custom-role assignment/effective-permissions query shapes.
- Add stable informational warnings or metadata to effective-permissions responses before building UI.
- Reduce `as never`, broad mocks, and `Reflect.construct` usage in tests.
- Consider database check constraints for SYSTEM/CUSTOM role invariants if DB drift becomes common.

## Final Recommendation

The branch is not a prototype and it does not violate the core product boundary. Access control is now a backend foundation for Super Admin-managed custom roles and additive user grants while preserving User.role, assignment-table scope, and workflow-controlled lifecycle changes.

Do a short cleanup phase for the required merge items above, then merge. Do not start UI work or broader custom-role delegation until those small safety and clarity gaps are closed.
