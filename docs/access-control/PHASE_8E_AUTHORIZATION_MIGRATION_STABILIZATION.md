# Phase 8E Authorization Migration Stabilization

## Executive Verdict

Phase 8 complete and ready for Phase 9

Phase 8 is stable after a small cleanup pass. The migrated static routes use `@RequirePermission` and `PermissionGuard`, dynamic workflow-adjacent routes retain manual `AccessPolicyService.assertCan(...)`, and high-risk persona/workflow/admin routes intentionally keep `@Roles`.

## Scope Summary

Phase 8 changed the route authorization perimeter only:

- Added `@RequirePermission(PermissionKey)`.
- Added reusable `PermissionGuard`.
- Migrated Access Control static routes to `JwtAuthGuard + PermissionGuard + @RequirePermission`.
- Migrated Notifications and selected low-risk Users routes to `PermissionGuard`.
- Migrated Users custom access-role assignment routes from Super Admin `@Roles` to Super Admin-only system permissions.
- Added `APPROVALS_VIEW_PENDING` and migrated `GET /api/approvals/pending`.
- Added target-role-sensitive policy coverage to request helper lookup/search routes while preserving their `@Roles` perimeter.

Phase 8 did not change workflows, approval routing, assignment services, schema, migrations, frontend, `User.role`, or `RequestApproval.approverRole`.

## Branch Diff Summary

Changed areas against `main`:

| Area | Status |
| --- | --- |
| `apps/api/src/access-control` | Changed for `PermissionGuard`, `@RequirePermission`, access-control route migration, and permission catalog/matrix update. |
| `apps/api/src/users/users.controller.ts` | Changed for selected low-risk route migration and user custom access-role assignment route migration. |
| `apps/api/src/notifications/notifications.controller.ts` | Changed for notification route migration. |
| `apps/api/src/approvals/approvals.controller.ts` | Changed for pending approvals permission guard. |
| `apps/api/src/requests/requests.controller.ts` | Changed only for helper route dynamic policy checks. |
| `apps/api/test/*access-control*`, `users/notifications/approvals/requests` policy tests | Changed for route metadata and policy coverage verification. |
| `docs/access-control/PHASE_8A_LEGACY_ROLE_AUTHORIZATION_INVENTORY.md` | Added Phase 8A inventory. |

Forbidden areas verified untouched by Phase 8 diff:

| Area | Status |
| --- | --- |
| `prisma` | No changes. |
| `apps/web` | No changes. |
| `apps/api/src/reports` | No changes. |
| `apps/api/src/workspaces` | No changes. |
| `apps/api/src/admin` | No changes. |
| `apps/api/src/assignments` | No changes. |
| `apps/api/src/chains` | No changes. |
| `apps/api/src/vendors` | No changes. |
| `apps/api/src/requests/workflows` | No changes. |
| `apps/api/src/requests/request-approval-routing.service.ts` | No changes. |

## Migrated Routes

| File | Route | Permission | Guard model | Status |
| --- | --- | --- | --- | --- |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/overview` | `ACCESS_CONTROL_VIEW` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/roles` | `ACCESS_CONTROL_VIEW_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/roles/:id` | `ACCESS_CONTROL_VIEW_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles` | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `PATCH /api/access-control/roles/:id` | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles/:id/deactivate` | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles/:id/permissions/sync` | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/effective-permissions/users/:id` | `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/notifications/notifications.controller.ts` | `GET /api/notifications` | `NOTIFICATIONS_VIEW` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/notifications/notifications.controller.ts` | `PATCH /api/notifications/:id/read` | `NOTIFICATIONS_MANAGE_OWN` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/notifications/notifications.controller.ts` | `PATCH /api/notifications/read-all` | `NOTIFICATIONS_MANAGE_OWN` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/me` | `USERS_VIEW_SELF` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `PATCH /api/users/me/preferences` | `USERS_EDIT_OWN_PREFERENCES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/:id/operational-profile` | `USERS_VIEW_OPERATIONAL_PROFILE` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/:id/access-role-assignments` | `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/access-role-assignments` | `ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/access-role-assignments/:assignmentId/revoke` | `ACCESS_CONTROL_REVOKE_CUSTOM_ROLES` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/approvals/approvals.controller.ts` | `GET /api/approvals/pending` | `APPROVALS_VIEW_PENDING` | `JwtAuthGuard + PermissionGuard` | Verified |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/offboarding/pickers` | Dynamic resignation permission from `targetRole` | `JwtAuthGuard + RolesGuard + manual assertCan` | Verified |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/offboarding/eligible-users` | Dynamic resignation permission from `targetRole` | `JwtAuthGuard + RolesGuard + manual assertCan` | Verified |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/new-hire/lookup-candidate` | Dynamic new-hire permission from `targetRole` | `JwtAuthGuard + RolesGuard + manual assertCan` | Verified |

## Remaining `@Roles` Inventory

Search result: 30 remaining `@Roles(...)` usages in `apps/api/src`. They are intentionally retained.

| File | Route/class | Roles | Reason retained | Classification | Future action |
| --- | --- | --- | --- | --- | --- |
| `apps/api/src/workspaces/workspaces.controller.ts` | Picker workspace | `PICKER` | Workspace response assumes Picker persona. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/workspaces/workspaces.controller.ts` | Champ workspace and branch routes | `CHAMP` | Uses Champ persona and assignment scope. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/workspaces/workspaces.controller.ts` | Area Manager workspace | `AREA_MANAGER` | Uses Area Manager persona and scope. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/workspaces/workspaces.controller.ts` | Admin workspace | `ADMIN`, `SUPER_ADMIN` | Admin workspace/persona surface. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/reports/reports.controller.ts` | Admin report overview | `ADMIN`, `SUPER_ADMIN` | Admin-shaped global report response. | persona/workspace | Defer until report scope is redesigned. |
| `apps/api/src/reports/reports.controller.ts` | Area Manager report overview | `AREA_MANAGER` | Service uses actor as Area Manager scope. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/reports/reports.controller.ts` | Champ report overview | `CHAMP` | Service uses actor as Champ scope. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/users/users.controller.ts` | Users list and operational list | `ADMIN`, `SUPER_ADMIN` | Admin-shaped listing; custom grants need separate visibility review. | hybrid workflow/admin | Defer to a users/admin authorization phase. |
| `apps/api/src/users/users.controller.ts` | Area Manager chain assignment routes | `ADMIN`, `SUPER_ADMIN` | Operational assignment mutation/scope sensitive. | hybrid workflow/admin | Defer to assignment-management phase. |
| `apps/api/src/users/users.controller.ts` | Admin profile update | `ADMIN`, `SUPER_ADMIN` | Sensitive profile mutation. | hybrid workflow/admin | Defer until profile-edit delegation is approved. |
| `apps/api/src/users/users.controller.ts` | Picker profile completion | `PICKER` | Picker-only workflow and response semantics. | persona/workspace | Keep role/persona guard. |
| `apps/api/src/requests/requests.controller.ts` | Offboarding picker search helpers | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | Workflow-adjacent helper; Phase 8D added dynamic policy but role perimeter stays. | hybrid workflow/admin | Revisit after workflow helper HTTP tests. |
| `apps/api/src/requests/requests.controller.ts` | New Hire candidate lookup helper | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | Workflow-adjacent helper; Phase 8D added dynamic policy but role perimeter stays. | hybrid workflow/admin | Revisit after workflow helper HTTP tests. |
| `apps/api/src/requests/requests.controller.ts` | Finalization routes | `ADMIN`, `SUPER_ADMIN` | Final lifecycle mutation remains Admin/Super Admin only. | hybrid workflow/admin | Do not remove without product approval. |
| `apps/api/src/admin/admin.controller.ts` | Admin controller class | `ADMIN`, `SUPER_ADMIN` | Admin/organization surfaces not migrated in Phase 8. | intentionally deferred | Separate admin/organization phase. |
| `apps/api/src/assignments/assignments.controller.ts` | Assignments controller class | `ADMIN`, `SUPER_ADMIN` | Direct assignment APIs are sensitive and partly intentionally rejected. | intentionally deferred | Separate assignment safety phase. |
| `apps/api/src/chains/chains.controller.ts` | Chains controller class | `ADMIN`, `SUPER_ADMIN` | Organization management not migrated in Phase 8. | intentionally deferred | Add organization permissions later. |
| `apps/api/src/vendors/vendors.controller.ts` | Vendor read routes | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | Organization visibility scope needs review before custom grants. | intentionally deferred | Separate organization visibility phase. |
| `apps/api/src/vendors/vendors.controller.ts` | Vendor mutation routes | `ADMIN`, `SUPER_ADMIN` | Organization mutation/audit surface. | hybrid workflow/admin | Separate organization management phase. |

## PermissionGuard Verification

Pass.

Evidence:

- `apps/api/src/access-control/permission.guard.ts` reads `REQUIRED_PERMISSION_KEY` metadata.
- If no permission metadata exists, the guard returns `true`.
- If metadata exists and `request.user` is absent, the guard throws `ForbiddenException`.
- The guard calls `AccessPolicyService.assertCan(request.user, requiredPermission)`.
- The guard performs no DB reads and does not make `hasPermission`, `can`, or `assertCan` async.
- `apps/api/test/access-control-permission.guard.test.ts` passed.

## Permission Matrix Verification

Pass.

Evidence:

- `APPROVALS_VIEW_PENDING` exists with `PermissionGroups.REQUESTS_APPROVALS`, `MEDIUM` risk, `assignable: true`, and `systemOnly: false`.
- `AREA_MANAGER`, `ADMIN`, and inherited `SUPER_ADMIN` have `APPROVALS_VIEW_PENDING`.
- `PICKER` and `CHAMP` do not have `APPROVALS_VIEW_PENDING`.
- Custom-role management permissions remain Super Admin-only, `systemOnly: true`, and `assignable: false`.
- `apps/api/test/access-control-permissions.test.ts` and `apps/api/test/access-control-role-permission-matrix.test.ts` passed.

## Workflow Safety Verification

Pass.

Evidence:

- `git diff --name-status main...HEAD -- apps/api/src/requests/workflows` returned no workflow service changes.
- `git diff --name-status main...HEAD -- apps/api/src/requests/request-approval-routing.service.ts` returned no approval-routing changes.
- Request helper service calls remain unchanged after the added policy gates.
- Approval approve/reject routes remain service-authority based; only pending approval listing moved to a static permission guard.
- Request finalization routes remain hybrid with `@Roles(ADMIN, SUPER_ADMIN)` and final lifecycle permission checks.
- New Hire, offboarding, approval, routing, and transfer regression tests passed.

## Persona/Workspace Safety Verification

Pass.

Evidence:

- Workspaces routes retain `@Roles`.
- Reports persona routes retain `@Roles`.
- Picker profile-completion routes retain `@Roles(UserRole.PICKER)`.
- No route that returns a role-shaped workspace/report was converted to custom-permission-only access.
- `User.role` remains primary persona/workspace state.

## Hybrid Routes Deferred

Deferred intentionally:

- `POST /api/requests/:id/finalize-new-hire`
- `POST /api/requests/:id/finalize-offboarding`
- `GET /api/requests/offboarding/pickers`
- `GET /api/requests/offboarding/eligible-users`
- `POST /api/requests/new-hire/lookup-candidate`
- `GET /api/users`
- `GET /api/users/operational-list`
- Area Manager chain assignment routes under `UsersController`
- `PATCH /api/users/:id/admin-profile`
- Picker profile-completion routes
- All Admin/organization, Assignments, Chains, Vendors, Reports, and Workspaces route groups

The reason is consistent: these routes are persona-shaped, workflow-adjacent, globally scoped, or operational-assignment-sensitive. They require separate review before any role perimeter is removed.

## Cleanup Fixes Applied

- Removed an unused `@CurrentUser()` parameter and `void user` from `UsersController.listAccessRoleAssignments`.
- Normalized the `REQUIRED_PERMISSION_KEY` import in `PermissionGuard`.

No behavior changes were made by these cleanup fixes.

## Tests / Checks Run

| Command | Result |
| --- | --- |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permission.guard.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-overview.controller.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-custom-roles.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-user-assignments.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-policy.service.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permissions.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-role-permission-matrix.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/notifications-access-policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-access-policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/approvals-access-policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/requests-access-policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.policy.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-payload.test.ts` | Passed |
| `npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts` | Passed |
| `npm run prisma:validate` | Passed |
| `npm run prisma:generate` | Initial run hit Windows Prisma DLL lock; after stopping Node processes, passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |

## Dev Startup / Smoke Verification

Pass.

| Check | Result |
| --- | --- |
| Ports `3000` and `4000` free before startup | Passed |
| `npm run dev` starts API without Nest dependency errors | Passed |
| `npm run dev` starts web | Passed |
| `GET http://localhost:4000/api/health` | `200` |
| `GET http://localhost:3000/login` | `200` |
| Unauthenticated `GET /api/access-control/overview` | `401` |
| Unauthenticated `GET /api/notifications` | `401` |
| Unauthenticated `GET /api/users/me` | `401` |
| Unauthenticated `GET /api/approvals/pending` | `401` |
| Unauthenticated `GET /api/requests/offboarding/pickers` | `401` |
| Unauthenticated `POST /api/requests/new-hire/lookup-candidate` | `401` |
| Ports `3000` and `4000` free after stopping dev processes | Passed |

## Known Risks

- Remaining hybrid routes still use `@Roles`; this is intentional but needs dedicated later phases.
- Direct controller tests verify metadata and service calls, but full HTTP/auth integration coverage remains limited.
- Custom permissions still rely on downstream service scope checks. This is correct, but future route migrations must preserve that boundary.
- Phase 7 permission caches are process-local; mutation paths refresh them, but multi-process invalidation remains a deployment consideration.
- Admin/organization/assignment/chains/vendors migration needs a separate phase because those services are global or mutation-heavy.
- Generic `POST /api/requests` remains a Phase 8A deferred authorization/product decision.

## Required Fixes Before Phase 9

None identified.

Recommended Phase 9 should run full regression and merge-readiness verification, including HTTP-level route authorization tests where practical.

## Final Recommendation

Proceed to Phase 9 full regression. Do not continue removing `@Roles` until Phase 9 confirms the Phase 8 migration is stable and a separate scoped phase is written for the next route group.
