# Access Control Branch Deep Review

## Executive Verdict

Continue only after fixes.

The branch is directionally correct and the requested verification suite passes. The runtime policy checks mostly act as additional gates and do not replace the existing assignment scope, request state, approval ownership, finalization, audit, or notification logic.

The branch should not continue directly into Phase 7I custom-role work until the high-risk cleanup items below are resolved. The current foundation is usable, but it is already close to becoming a generic SaaS-style role system if custom assignment semantics are not tightened before any UI/API is added.

## Overall Score

- Architecture: 7/10
- Security: 7/10
- Workflow safety: 9/10
- Permission model: 7/10
- Database design: 8/10
- Test quality: 6/10
- Maintainability: 6/10
- Product fit: 8/10

## What Was Done Right

- `apps/api/src/access-control/permissions.ts` / permission catalog: The catalog is centralized, typed, grouped, and includes metadata for risk, assignability, and system-only permissions. This is the right foundation for moving away from scattered hardcoded role coupling. Recommended action: keep it code-owned until product rules for custom roles are mature.

- `apps/api/src/access-control/role-permission.matrix.ts` / `SYSTEM_ROLE_PERMISSIONS`: The system role matrix preserves the current `UserRole` model and keeps Super Admin as Admin plus system-owner permissions. This keeps `User.role` as the operational persona instead of replacing it with generic access roles. Recommended action: preserve this split.

- `apps/api/src/access-control/approval-authority.ts` / approval authority mapping: `ApprovalStep` was not renamed or replaced. The mapping gives vocabulary to current workflow steps without schema churn. Recommended action: keep using it only as a translation layer.

- `apps/api/src/requests/requests.controller.ts` / request policy gates: Request visibility, submit/cancel, workflow creation, and finalization checks are controller-level permission gates while `RequestsService` and workflow services still enforce ownership, status, assignment scope, and lifecycle mutation safety. Recommended action: keep service-level workflow checks authoritative.

- `apps/api/src/approvals/approvals.service.ts` / `approve()` and `reject()`: The policy check is inserted after loading the approval and before `assertCanDecide()`, but does not replace `assertCanDecide()`. This preserves current-step, status, and approver ownership checks. Recommended action: keep this call order.

- `apps/api/src/users/users.controller.ts` / users policy gates: The controller adds permission gates without changing `UsersService` behavior for temporary passwords, profile updates, profile completion, or Area Manager chain assignment safety rules. Recommended action: continue to keep sensitive target-user checks in `UsersService`.

- `prisma/schema.prisma` / `AccessRole`, `AccessRolePermission`, `UserAccessRoleAssignment`: The schema is additive. `User.role` and `RequestApproval.approverRole` remain intact. Operational scope remains in assignment tables. Recommended action: do not use `AccessRole` to model workspace/persona.

- `prisma/migrations/20260522162758_add_active_user_access_role_assignment_unique_index/migration.sql`: The active-only partial unique index is the right PostgreSQL shape. It blocks duplicate active assignments while preserving inactive history. Recommended action: keep this as explicit SQL; do not replace it with `@@unique([userId, accessRoleId, status])`.

- `apps/web/app/super-admin/access-control/page.tsx` and `apps/web/components/dashboard/role-nav.ts`: The read-only Access Control page is Super Admin-only in the frontend and does not expose mutation UI. Recommended action: keep the page read-only until backend semantics are settled.

## What Is Risky

- High - `apps/api/src/access-control/access-policy.service.ts` / `buildValidatedDbUserAccessRolePermissionCache()`: CUSTOM user assignments validate only that a permission key exists. They do not reject `systemOnly: true` or `assignable: false` permissions from `apps/api/src/access-control/permissions.ts`. Why it matters: a manually inserted CUSTOM role could grant system-owner permissions such as access-control or system-settings permissions to a non-Super Admin actor. Existing `@Roles` perimeters still block some current routes, but future policy-only endpoints could be exposed. Recommended action: before Phase 7I, decide and enforce that CUSTOM role permissions must be `assignable: true` and `systemOnly: false`, or explicitly document a stricter exception process.

- High - `apps/api/src/access-control/access-policy.service.ts` / `loadDbUserAccessRolePermissionCache()`: Phase 7H made `UserAccessRoleAssignment` runtime-active before there is an assignment API, audit trail, cache refresh mechanism, or role-management UI. Why it matters: manual DB writes can now affect authorization after API restart without product workflow, review, or audit. Recommended action: either add a feature/config gate until assignment APIs exist, or document that manual DB edits are privileged operations and add audit/API work before any real use.

- High - `apps/api/src/access-control/access-control.controller.ts` / `getOverview()`: The overview endpoint returns `SYSTEM_ROLE_PERMISSIONS` from code while `AccessPolicyService` may use DB-backed SYSTEM role permissions at runtime. Why it matters: once DB system permissions diverge from the code matrix, the Super Admin page can show a stale matrix that does not match enforcement. Recommended action: before DB-managed role work, expose the effective runtime source or clearly label the page as code-catalog only.

- High - `prisma/access-role-seed.ts` / `syncSystemAccessRolePermissions()`: The seed deletes stale permissions for SYSTEM roles when they are no longer in `SYSTEM_ROLE_PERMISSIONS`. Why it matters: this is correct if code remains the system-role source of truth, but conflicts with a future model where DB system permissions intentionally diverge from code. Running `db:seed` would silently overwrite DB-managed system-role edits. Recommended action: decide before Phase 7I whether SYSTEM role permissions are code-owned or DB-owned. If DB-owned, stop destructive stale sync outside controlled migrations.

- Medium - `docs/access-control/PHASE_7_STABILIZATION_REPORT.md` and `docs/access-control/PHASE_7G_USER_ACCESS_ROLE_ASSIGNMENT_RULES.md`: These documents still say `UserAccessRoleAssignment` is inert and not read by authorization. Why it matters: current `AccessPolicyService` does read active CUSTOM assignments, so the docs now contradict runtime behavior. Recommended action: update Phase 7 documentation before continuing.

- Medium - `apps/api/src/access-control/access-policy.service.ts` / `onModuleInit()`: DB system and custom assignment permissions are cached only at startup. Why it matters: future role-management UI/API changes will not affect authorization until restart unless cache invalidation is added. Recommended action: design cache invalidation, reload, or TTL before adding role mutation APIs.

- Medium - `apps/api/src/access-control/access-policy.service.ts`: The service now owns permission checks, DB system cache loading, custom assignment cache loading, validation, fallback behavior, and warning logs. Why it matters: it is still manageable, but it is becoming a policy engine plus repository plus cache manager. Recommended action: split DB cache loading into a provider/repository before adding write APIs.

- Medium - `apps/api/src/access-control/access-control.module.ts` and `apps/api/src/users/users.module.ts`: `AccessControlModule` imports `UsersModule`, while `UsersModule` imports `forwardRef(() => AccessControlModule)`. Why it matters: the app builds, but the module graph is fragile and repeats `JwtModule.register({})` in feature modules to satisfy guards. Recommended action: separate the policy provider module from the guarded overview controller module, or import a stable auth/guard dependency once the cycle is untangled.

- Medium - `apps/api/src/requests/requests.controller.ts` / `submit()`: Submit is gated by `REQUESTS_VIEW` because no dedicated submit permission exists. Why it matters: this is acceptable as a temporary coarse gate because `RequestsService.submit()` still enforces creator/Admin and DRAFT status, but it is semantically weak. Recommended action: add a narrow submit permission only if product wants submit controlled separately.

- Medium - `apps/api/src/access-control/permissions.ts`: High-risk lifecycle, approval, temporary-password, profile-edit, and assignment-management permissions are marked `assignable: true`. Why it matters: this is powerful for future custom roles, but dangerous without role-category compatibility rules and operational scope constraints. Recommended action: before custom-role UI/API, define which roles can receive which permission families.

- Low - `prisma/schema.prisma` / `AccessRolePermission.permissionKey`: Permission keys are strings and not backed by a `Permission` table or FK. Why it matters: DB drift is possible; the service falls back or ignores custom grants if unknown keys appear, but the database itself cannot enforce catalog validity. Recommended action: acceptable for code-owned catalog; add health checks or a Permission table only if DB ownership expands.

## What Looks Over-Engineered

- `apps/api/src/access-control/access-policy.service.ts`: The synchronous public API forced a startup cache design for both SYSTEM and CUSTOM permissions. This is workable, but it is heavier than the current product needs because there is no custom-role UI/API yet. Recommended action: keep it, but do not add more responsibility to this class.

- `prisma/schema.prisma` / `AccessRole` plus `UserAccessRoleAssignment`: The DB foundation is ahead of product surfaces. This is not wrong, but it is on the edge of generic SaaS complexity. Recommended action: keep the schema as foundation only and require product decisions before any assignment API.

- `apps/web/components/access-control/access-control-overview-page.tsx`: The page is acceptable as read-only, but it is a full matrix browser before DB-backed role management actually exists. Recommended action: keep it read-only and avoid expanding it into a role builder until semantics are settled.

## What Looks Hardcoded or Fragile

- `apps/api/src/access-control/role-permission.matrix.ts`: The system matrix is intentionally hardcoded. That is acceptable for Phase 7, but it means code, seed, DB cache, and UI can drift. Recommended action: pick one authoritative source per phase and expose it consistently.

- `prisma/access-role-seed.ts` / stable keys: `system.picker`, `system.champ`, `system.area_manager`, `system.admin`, and `system.super_admin` are hardcoded. Why it matters: stable keys are good, but renaming them later would be data migration work. Recommended action: treat them as permanent identifiers.

- `apps/api/src/requests/requests.controller.ts` / `permissionForNewHireTargetRole()` and `permissionForOffboardingTargetRole()`: The mapping is intentionally hardcoded to `PICKER`, `CHAMP`, and `AREA_MANAGER`. Why it matters: this matches the current workflow matrix, but any new target role must update controller mapping, permissions, matrix, workflow policy, and tests together. Recommended action: keep hardcoded until more roles exist; do not prematurely abstract.

- `apps/api/test/requests-access-policy.test.ts` / `Reflect.construct`: The test bypasses TypeScript constructor visibility rather than using a typed factory. Why it matters: it makes tests harder for future agents to maintain. Recommended action: cleanup later; not a merge blocker.

- `apps/api/test/access-control-policy.service.test.ts` / `as never` mocks: The tests use brittle type coercion around mocked Prisma objects. Why it matters: they verify intended behavior but can miss real Prisma shape mismatches. Recommended action: add one integration-style test or typed test helper before role-management APIs.

## What May Break Later

- `apps/api/src/access-control/access-policy.service.ts` / startup-only cache: Role assignment changes will not take effect until restart. Recommended action: design invalidation before adding mutation APIs.

- `apps/api/src/access-control/access-control.controller.ts` / overview response: The UI can show the code matrix while runtime uses DB cache. Recommended action: expose effective runtime permissions or DB/system sync status.

- `prisma/access-role-seed.ts` / stale permission deletion: Running seed after DB-managed edits could revert system-role permission changes. Recommended action: settle code-owned vs DB-owned system role policy first.

- `apps/api/src/access-control/permissions.ts` / `assignable` metadata: The metadata is not enforced by the runtime CUSTOM assignment cache. Recommended action: enforce it before custom assignments are used by real users.

- `apps/api/src/access-control/access-control.module.ts` / module graph: The current module cycle may become harder to reason about as Access Control grows. Recommended action: separate pure policy provider from guarded controller module.

## Workflow Safety Assessment

Request -> Approval -> System applies change is still protected.

- `apps/api/src/requests/requests.controller.ts` adds policy gates before service calls, but `apps/api/src/requests/requests.service.ts` and workflow services still perform creation, submit, cancel, finalization, status-transition, approval-generation, audit, and notification behavior.
- `apps/api/src/approvals/approvals.service.ts` adds approval permission gates, but `assertCanDecide()` still checks pending status, current step, expected request status, and ownership/scope through `RequestsService.userCanActOnStep()`.
- `apps/api/src/requests/workflows/*` were not changed in this branch diff, and workflow regression tests passed.
- `apps/api/src/assignments/assignments.service.ts` still rejects direct Picker assignment create/close and keeps Picker assignment lifecycle changes workflow-based.

Recommended action: keep AccessPolicyService permission-only. Do not move assignment scope or lifecycle state checks into it.

## User.role vs AccessRole Assessment

The separation is mostly clean today.

- `prisma/schema.prisma` keeps `User.role`.
- `prisma/schema.prisma` keeps `RequestApproval.approverRole`.
- `apps/api/src/auth/guards/roles.guard.ts` and `@Roles(...)` remain in use as perimeter controls.
- `AccessRole` and `UserAccessRoleAssignment` do not replace workspace routing or assignment scope.

The risk is conceptual drift. `UserAccessRoleAssignment` can now add runtime permissions, so future product work must keep repeating that it does not convert Picker to Champ, does not create operational assignments, and does not change login redirects.

Recommended action: keep `User.role` as persona/workspace. Treat access-role assignments as additive permission grants only.

## Custom Assignment Runtime Assessment

Phase 7H is technically implemented in the intended additive shape, but it was premature.

- `apps/api/src/access-control/access-policy.service.ts` checks base role permissions first and custom user grants second.
- SYSTEM role assignments are ignored by the query.
- inactive, expired, and future assignments are filtered out.
- unknown custom permission keys disable the custom grant cache instead of throwing at startup.

The problem is not the mechanics. The problem is operational readiness. There is no assignment API, no audit trail for assignment changes, no cache invalidation, no role-category compatibility rules, and no enforcement of `assignable`/`systemOnly` metadata for CUSTOM roles.

Recommended action: before Phase 7I, either add a cleanup/design phase for custom assignment runtime semantics or gate CUSTOM assignment reads until an audited API exists.

## Database and Migration Assessment

The schema and migrations are additive and safe.

- `prisma/migrations/20260522111246_add_access_roles/migration.sql` creates only `AccessRoleKind`, `AccessRoleStatus`, `AccessRole`, `AccessRolePermission`, and related indexes/FKs.
- `prisma/migrations/20260522121209_add_user_access_role_assignments/migration.sql` creates only `AccessRoleAssignmentStatus`, `UserAccessRoleAssignment`, indexes, and FKs.
- `prisma/migrations/20260522162758_add_active_user_access_role_assignment_unique_index/migration.sql` adds only the active partial unique index.
- `prisma/schema.prisma` leaves `User.role` and `RequestApproval.approverRole` intact.
- No tenant/country tables or Permission table were added.

Recommended action: add database check constraints later only if DB drift becomes a real issue, for example `kind`, `isSystem`, and `systemRole` consistency.

## AccessPolicyService Assessment

`AccessPolicyService` is clean enough for the current branch but should not grow further.

Good:
- Public methods remain synchronous.
- Code-matrix fallback remains available.
- DB system cache failure falls back conservatively.
- CUSTOM assignment cache failure ignores custom grants and preserves base behavior.
- Context is accepted but inert, so scope remains in services.

Problems:
- It now contains two cache loaders, validation logic, fallback state, and permission checks.
- It has no invalidation path.
- CUSTOM grant validation ignores `assignable` and `systemOnly`.
- It provides no way for the overview endpoint to expose effective runtime DB permissions.

Recommended action: before adding role mutation APIs, split cache loading and validation into a dedicated provider or repository, and define invalidation.

## Module Dependency Assessment

The module graph works but is fragile.

- `apps/api/src/access-control/access-control.module.ts` imports `UsersModule` and registers `JwtModule`.
- `apps/api/src/users/users.module.ts` imports `forwardRef(() => AccessControlModule)`.
- `apps/api/src/requests/requests.module.ts`, `apps/api/src/approvals/approvals.module.ts`, `apps/api/src/reports/reports.module.ts`, and `apps/api/src/notifications/notifications.module.ts` import `AccessControlModule`.

Why it matters: the access-control provider and guarded access-control overview controller live in the same module. The controller needs auth guard dependencies, while other feature modules only need `AccessPolicyService`. This coupling caused earlier startup risk and can do so again.

Recommended action: split into a pure policy module and a controller module, or otherwise isolate guard dependencies from policy provider exports.

## Test Quality Assessment

The test volume is good, and the requested focused policy and workflow regression tests pass.

Weak spots:
- `apps/api/test/access-control-policy.service.test.ts`: heavily mocked Prisma shape with `as never`; no real DB integration for custom assignment grants. Why it matters: query filter shape and Prisma relation behavior are easy to fake incorrectly. Recommended action: add a small integration-style verification before assignment APIs.
- `apps/api/test/requests-access-policy.test.ts`: uses `Reflect.construct` to instantiate the controller. Why it matters: it is awkward and fragile. Recommended action: replace with a typed test factory later.
- Controller policy tests are direct unit tests and do not exercise Nest guards or module DI. Why it matters: guard metadata and DI regressions may slip. Recommended action: add a thin e2e smoke test for protected routes before merge if practical.
- No test verifies that CUSTOM role permissions obey `assignable`/`systemOnly`. Why it matters: this is the biggest custom-grant security gap. Recommended action: add this once behavior is decided.
- No test verifies that the Access Control overview matches effective DB-backed runtime permissions. Why it matters: the current endpoint can drift from enforcement. Recommended action: add after endpoint semantics are corrected.

## Security Assessment

No direct lifecycle bypass was found.

Security risks:
- High - `apps/api/src/access-control/access-policy.service.ts`: CUSTOM assignments can grant any known permission, including non-assignable system-only permissions, if rows are inserted directly. Recommended action: enforce permission metadata for CUSTOM grants.
- High - `apps/api/src/access-control/access-policy.service.ts`: manual DB rows can activate custom grants without audit. Recommended action: require audited assignment API before real use, or add a config gate.
- Medium - `apps/api/src/access-control/access-policy.service.ts`: startup cache means revocations are stale until restart. Recommended action: implement invalidation before UI/API mutation.
- Medium - `apps/api/src/access-control/access-control.controller.ts`: overview can misrepresent runtime policy source. Recommended action: expose effective runtime matrix or cache source.
- Medium - `prisma/access-role-seed.ts`: seed can overwrite system-role permission DB changes. Recommended action: define source of truth before DB system role management.

## Required Fixes Before Continuing

Blockers before continuing Phase 7I:

- Fix the docs mismatch in `docs/access-control/PHASE_7_STABILIZATION_REPORT.md` and `docs/access-control/PHASE_7G_USER_ACCESS_ROLE_ASSIGNMENT_RULES.md`: they say `UserAccessRoleAssignment` is inert, but `AccessPolicyService` now reads active CUSTOM assignments.
- Decide and enforce CUSTOM role permission eligibility in `apps/api/src/access-control/access-policy.service.ts`: at minimum, CUSTOM grants should not include `systemOnly: true` or `assignable: false` permissions unless the product owner explicitly approves.
- Decide whether Phase 7I is allowed to rely on startup-only caches. If not, design invalidation before adding assignment APIs or UI.
- Decide whether SYSTEM role permissions are code-owned or DB-owned. Align `prisma/access-role-seed.ts`, `AccessPolicyService`, and `AccessControlController.getOverview()` with that decision.
- Fix the Access Control overview mismatch so `apps/api/src/access-control/access-control.controller.ts` does not show code matrix data as if it were the enforced DB-backed runtime matrix.

Should fix before merge to main:

- Split `AccessPolicyService` cache loading from the policy check API, or at least document it as a temporary combined service.
- Reduce `AccessControlModule` / `UsersModule` circular dependency risk by separating provider-only access control from the guarded overview controller.
- Add at least one integration-style policy/cache test that uses Prisma-generated shapes, not only hand-built mocks.
- Add a route-level smoke test for the Super Admin-only access-control overview.

Can defer to cleanup:

- Replace `Reflect.construct` in `apps/api/test/requests-access-policy.test.ts`.
- Reduce `as never` and broad `any` in policy tests.
- Add database check constraints for `AccessRole.kind`, `AccessRole.isSystem`, and `AccessRole.systemRole` invariants if DB drift becomes common.

Not a problem / intentional design:

- Keeping `User.role`, `@Roles`, `RolesGuard`, and `RequestApproval.approverRole`.
- Keeping operational scope in assignment tables.
- Keeping workflow finalization and approval decisions in existing services.
- Using a string `permissionKey` while the permission catalog remains code-owned.
- Leaving the frontend Access Control page read-only.

## Recommended Next Phase

Do a cleanup phase first.

Do not continue to Phase 7I implementation until the custom assignment runtime semantics, cache invalidation expectations, system-vs-code source of truth, and overview accuracy issues are resolved.

## Final Recommendation

The branch is not broken, and the workflow safety line is still intact. The main risk is that Phase 7 moved from a safe foundation into runtime custom grants before the product and operational controls caught up. Freeze feature expansion, clean up the semantics and docs, then continue with Phase 7I design.

## Verification Performed

- `git diff --stat main...HEAD`
- `git diff --name-status main...HEAD`
- `git diff main...HEAD -- prisma/schema.prisma`
- `git diff main...HEAD -- apps/api/src`
- `git diff main...HEAD -- apps/web`
- `git diff main...HEAD -- docs/access-control`
- `git diff main...HEAD -- prisma`
- `rg "@Roles\\("`
- `rg "UserRole"`
- `rg "roleHasPermission"`
- `rg "AccessPolicyService"`
- `rg "assertCan"`
- `rg "UserAccessRoleAssignment"`
- `rg "AccessRole"`
- `rg "PermissionKeys"`
- `rg "any"`
- `rg "as never"`
- `rg "Reflect.construct"`
- `rg "TODO|FIXME|HACK|TEMP|workaround"`
- `rg "systemRole"`
- `rg "isSystem"`
- `rg "ACCESS_CONTROL"`
- `rg "APPROVALS_DECIDE"`
- `rg "REQUESTS_CREATE"`
- `rg "RequestApproval"`
- `rg "ApprovalStep"`
- `rg "forwardRef"`

Focused tests passed:

- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-policy.service.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-system-role-seed.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-role-permission-matrix.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permissions.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-overview.controller.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/reports-access-policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/notifications-access-policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-access-policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/requests-access-policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/approvals-access-policy.test.ts`

Workflow regression tests passed:

- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.policy.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-payload.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-area-manager-chain-assignments.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-list-filters.test.ts`
- `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-admin-profile.dto.test.ts`

Build checks passed:

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
