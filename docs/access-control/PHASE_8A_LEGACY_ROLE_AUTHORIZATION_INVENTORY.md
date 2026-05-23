# Phase 8A Legacy Role Authorization Inventory

## Executive Verdict

Safe to start Phase 8B

The branch is on `feature/policy-authorization-v1`, and `HEAD` is based on the merged `main` access-control foundation. Phase 8 can start, but it must not blindly remove role checks. The route perimeter is mixed:

- Some routes are already policy-ready and only keep `@Roles` as a redundant perimeter.
- Some routes are role/persona-shaped and must keep `@Roles` or an equivalent persona guard.
- Some routes need policy coverage added before any role guard is removed.
- Service-level `user.role` checks mostly encode workflow, scope, target-role, or response-shaping rules and must stay.

Recommended Phase 8B shape: add a static permission decorator and guard for simple static permissions, while keeping manual `accessPolicy.assertCan(...)` for dynamic permissions. Do not replace service-level workflow or scope checks.

## Current Authorization Model

Current authorization is layered:

- `JwtAuthGuard` authenticates requests and attaches `request.user`.
- `@Roles(...)` writes static `UserRole` metadata through `apps/api/src/auth/decorators/roles.decorator.ts`.
- `RolesGuard` in `apps/api/src/auth/guards/roles.guard.ts` denies when `request.user.role` is not one of the declared roles.
- `AccessPolicyService` checks permission keys synchronously through `hasPermission`, `can`, and `assertCan`.
- `AccessPolicyService` can load DB-backed SYSTEM role permissions and ACTIVE CUSTOM user assignment grants, with code-matrix fallback.
- Service methods still enforce request ownership, workflow state, approval current step, target role, operational assignment scope, audit behavior, and notification behavior.

This means route authorization is not the same thing as workflow safety. Permission checks should open the route perimeter. Existing services must remain the source of target-user safety, operational scope, lifecycle state, and workflow transitions.

## Inventory Summary

Search counts from `apps/api/src`:

| Item | Count | Notes |
| --- | ---: | --- |
| `@Roles(` decorators | 34 | Includes class-level and method-level role metadata. |
| `RolesGuard` text matches | 36 | Includes imports, providers, guard class, and route usage. |
| `accessPolicy.assertCan` calls | 42 | Runtime permission gates added through Phase 7. |
| `roleHasPermission` matches | 3 | Matrix helper and `AccessPolicyService` fallback. |
| `getPermissionsForRole` matches | 6 | Matrix helper plus effective-permissions read path/tests. |
| `UserRole.` matches | 314 | Mostly workflow, scope, DTO, and response-shaping logic. |
| `user.role` matches | 49 | Mostly service-level business/scope logic. |
| `request.user.role` matches | 1 | `RolesGuard` perimeter check. |

Route inventory counts:

| Classification | Route entries | Summary |
| --- | ---: | --- |
| Convert to policy-only | 29 | Static permission gates already represent route intent, or can do so without changing workflow behavior. |
| Keep role/persona guard intentionally | 11 | Workspace/report/profile-completion routes are shaped around `User.role` persona. |
| Hybrid for now | 24 | Policy should exist, but `@Roles` should stay until high-risk workflow/admin/scope assumptions are tested. |
| Needs new permission key | 3 | Pending approvals, generic request create, and admin pending-actions need explicit permission decisions. |
| Not authorization | Many service checks | Role checks used for workflow branching, target-role validation, scope filtering, or response shaping. |

## Route Classification Table

| File | Method/route | Current guards | Current `@Roles` | Policy check if any | Classification | Recommended action | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/overview` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_VIEW` | Convert to policy-only | Later remove `@Roles` after static permission guard exists; permission is system-only and Super Admin-only. | Low |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/roles` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_VIEW_CUSTOM_ROLES` | Convert to policy-only | Same as above. | Low |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/roles/:id` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_VIEW_CUSTOM_ROLES` | Convert to policy-only | Same as above. | Low |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | Convert to policy-only | Same as above; keep service mutation guardrails/audit. | Medium |
| `apps/api/src/access-control/access-control.controller.ts` | `PATCH /api/access-control/roles/:id` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | Convert to policy-only | Same as above. | Medium |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles/:id/deactivate` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | Convert to policy-only | Same as above. | Medium |
| `apps/api/src/access-control/access-control.controller.ts` | `POST /api/access-control/roles/:id/permissions/sync` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES` | Convert to policy-only | Same as above. | Medium |
| `apps/api/src/access-control/access-control.controller.ts` | `GET /api/access-control/effective-permissions/users/:id` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` class | `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` | Convert to policy-only | Same as above; read audit remains in service. | Low |
| `apps/api/src/users/users.controller.ts` | `GET /api/users` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_LIST_OPERATIONAL` | Hybrid for now | Do not remove `@Roles` until list/global visibility semantics for custom grants are approved. | Medium |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/operational-list` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_LIST_OPERATIONAL` | Hybrid for now | Same as `/api/users`; service currently returns admin-style operational listing. | Medium |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/me` | `JwtAuthGuard` | none | `USERS_VIEW_SELF` | Convert to policy-only | Already policy-only. Keep service self lookup. | Low |
| `apps/api/src/users/users.controller.ts` | `PATCH /api/users/me/preferences` | `JwtAuthGuard` | none | `USERS_EDIT_OWN_PREFERENCES` | Convert to policy-only | Already policy-only. | Low |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/:id/operational-profile` | `JwtAuthGuard` | none | `USERS_VIEW_OPERATIONAL_PROFILE` | Convert to policy-only | Already policy-only; `UsersService.getOperationalPermissions` still enforces target/scope. | Medium |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/:id/access-role-assignments` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` | `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS` | Convert to policy-only | Permission is system-only and Super Admin-only. | Low |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/access-role-assignments` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` | `ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES` | Convert to policy-only | Permission is system-only; keep assignment service validation/audit/cache refresh. | Medium |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/access-role-assignments/:assignmentId/revoke` | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` | `ACCESS_CONTROL_REVOKE_CUSTOM_ROLES` | Convert to policy-only | Permission is system-only; keep revoke service validation/audit/cache refresh. | Medium |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/:id/area-manager-chain-assignments` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS` | Hybrid for now | Add policy guard if converted, but keep role/service admin perimeter until assignment-management delegation is approved. | High |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/area-manager-chain-assignments` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS` | Hybrid for now | Keep service target validation, open-request blocking, audit. | High |
| `apps/api/src/users/users.controller.ts` | `DELETE /api/users/:id/area-manager-chain-assignments/:assignmentId` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS` | Hybrid for now | Same as above. | High |
| `apps/api/src/users/users.controller.ts` | `PATCH /api/users/:id/admin-profile` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `USERS_EDIT_PROFILE` | Hybrid for now | Keep role perimeter until profile-edit delegation and service target rules are reviewed for custom grants. | High |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/reveal-temporary-password` | `JwtAuthGuard` | none | `USERS_READ_TEMPORARY_PASSWORD` | Convert to policy-only | Already policy-only; `UsersService.assertCanManagePassword` remains target/scope safety. | High |
| `apps/api/src/users/users.controller.ts` | `POST /api/users/:id/reset-temporary-password` | `JwtAuthGuard` | none | `USERS_MANAGE_TEMPORARY_PASSWORD` | Convert to policy-only | Already policy-only; keep service safety and audit. | High |
| `apps/api/src/users/users.controller.ts` | `GET /api/users/me/profile-completion` | `JwtAuthGuard`, `RolesGuard` | `PICKER` | `USERS_COMPLETE_OWN_PICKER_PROFILE` | Keep role/persona guard intentionally | This route is Picker persona-specific; service also validates target is Picker. | Low |
| `apps/api/src/users/users.controller.ts` | `PATCH /api/users/me/profile-completion` | `JwtAuthGuard`, `RolesGuard` | `PICKER` | `USERS_COMPLETE_OWN_PICKER_PROFILE` | Keep role/persona guard intentionally | Same as above. | Medium |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests` | `JwtAuthGuard` | none | `REQUESTS_VIEW` | Convert to policy-only | Already policy-only; `RequestsService.list` remains visibility source. | Medium |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/my/submitted` | `JwtAuthGuard` | none | `REQUESTS_VIEW` | Convert to policy-only | Already policy-only; service filters submitted requests. | Low |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/:id` | `JwtAuthGuard` | none | `REQUESTS_VIEW` | Convert to policy-only | Already policy-only; `canViewRequest` remains authoritative. | Medium |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/offboarding/pickers` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add policy based on resignation target role; keep service target/scope checks. | High |
| `apps/api/src/requests/requests.controller.ts` | `GET /api/requests/offboarding/eligible-users` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Same as above; targetRole drives permission choice. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/new-hire/lookup-candidate` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add dynamic policy using New Hire target-role mapping; keep candidate/workflow checks. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/new-hire` | `JwtAuthGuard` | none | dynamic `REQUESTS_CREATE_NEW_HIRE_*` | Convert to policy-only | Already policy-only; workflow service target/scope rules must stay. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/offboarding` | `JwtAuthGuard` | none | dynamic `REQUESTS_CREATE_RESIGNATION_*` | Convert to policy-only | Already policy-only; workflow service target/scope rules must stay. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/transfer` | `JwtAuthGuard` | none | `REQUESTS_CREATE_TRANSFER_PICKER` | Convert to policy-only | Already policy-only; transfer workflow role/scope checks must stay. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/:id/finalize-new-hire` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `APPROVALS_DECIDE_FINAL_LIFECYCLE` | Hybrid for now | Keep `@Roles` until final lifecycle delegation is explicitly approved and finalization services are reviewed. | Critical |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/:id/finalize-offboarding` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `APPROVALS_DECIDE_FINAL_LIFECYCLE` | Hybrid for now | Same as above. | Critical |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests` | `JwtAuthGuard` | none | none | Needs new permission key | Generic create endpoint should either be deprecated or get an explicit `REQUESTS_CREATE_GENERIC` style gate. | High |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/:id/submit` | `JwtAuthGuard` | none | `REQUESTS_VIEW` | Convert to policy-only | Already policy-only; service ownership/DRAFT checks remain. | Medium |
| `apps/api/src/requests/requests.controller.ts` | `POST /api/requests/:id/cancel` | `JwtAuthGuard` | none | `REQUESTS_CANCEL` | Convert to policy-only | Already policy-only; service ownership/status checks remain. | Medium |
| `apps/api/src/approvals/approvals.controller.ts` | `GET /api/approvals/pending` | `JwtAuthGuard` | none | none | Needs new permission key | Add `APPROVALS_VIEW_PENDING` or use a documented existing key; service scope filtering remains. | Medium |
| `apps/api/src/approvals/approvals.controller.ts` | `POST /api/approvals/:approvalId/approve` | `JwtAuthGuard` | none | service maps step to `APPROVALS_DECIDE_*` | Convert to policy-only | Already policy-gated in `ApprovalsService`; keep `assertCanDecide`. | Critical |
| `apps/api/src/approvals/approvals.controller.ts` | `POST /api/approvals/:approvalId/reject` | `JwtAuthGuard` | none | service maps step to `APPROVALS_DECIDE_*` | Convert to policy-only | Same as approve. | Critical |
| `apps/api/src/reports/reports.controller.ts` | `GET /api/reports/admin/overview` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | `REPORTS_VIEW_ADMIN` | Keep role/persona guard intentionally | Admin report response is global/admin-shaped; do not grant to non-admin custom roles without service review. | High |
| `apps/api/src/reports/reports.controller.ts` | `GET /api/reports/area-manager/overview` | `JwtAuthGuard`, `RolesGuard` | `AREA_MANAGER` | `REPORTS_VIEW_AREA_MANAGER` | Keep role/persona guard intentionally | Endpoint uses `user.id` as Area Manager scope. | Medium |
| `apps/api/src/reports/reports.controller.ts` | `GET /api/reports/champ/overview` | `JwtAuthGuard`, `RolesGuard` | `CHAMP` | `REPORTS_VIEW_CHAMP` | Keep role/persona guard intentionally | Endpoint uses `user.id` as Champ scope. | Medium |
| `apps/api/src/notifications/notifications.controller.ts` | `GET /api/notifications` | `JwtAuthGuard` | none | `NOTIFICATIONS_VIEW` | Convert to policy-only | Already policy-only and user-scoped. | Low |
| `apps/api/src/notifications/notifications.controller.ts` | `PATCH /api/notifications/:id/read` | `JwtAuthGuard` | none | `NOTIFICATIONS_MANAGE_OWN` | Convert to policy-only | Already policy-only and user-scoped. | Low |
| `apps/api/src/notifications/notifications.controller.ts` | `PATCH /api/notifications/read-all` | `JwtAuthGuard` | none | `NOTIFICATIONS_MANAGE_OWN` | Convert to policy-only | Already policy-only and user-scoped. | Low |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/picker` | `JwtAuthGuard`, `RolesGuard` | `PICKER` | none | Keep role/persona guard intentionally | Workspace response assumes Picker persona. | Low |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/champ` | `JwtAuthGuard`, `RolesGuard` | `CHAMP` | none | Keep role/persona guard intentionally | Workspace response assumes Champ persona. | Low |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/champ/branches` | `JwtAuthGuard`, `RolesGuard` | `CHAMP` | none | Keep role/persona guard intentionally | Champ workspace list uses `user.id` as Champ assignment scope. | Low |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/champ/branches/:vendorId` | `JwtAuthGuard`, `RolesGuard` | `CHAMP` | none | Keep role/persona guard intentionally | Champ branch detail uses Champ assignment scope. | Medium |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/area-manager` | `JwtAuthGuard`, `RolesGuard` | `AREA_MANAGER` | none | Keep role/persona guard intentionally | Workspace response assumes Area Manager persona. | Low |
| `apps/api/src/workspaces/workspaces.controller.ts` | `GET /api/workspaces/admin` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | none | Keep role/persona guard intentionally | Admin workspace is role/persona surface. | Low |
| `apps/api/src/admin/admin.controller.ts` | `GET /api/admin/pending-actions` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Needs new permission key | Add explicit pending-action/admin queue permission or map to final lifecycle view. | Medium |
| `apps/api/src/admin/admin.controller.ts` | `GET /api/admin/archived-users` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Existing `USERS_LIST_OPERATIONAL` may fit; keep role until archived-user scope is reviewed. | Medium |
| `apps/api/src/admin/admin.controller.ts` | `GET /api/admin/audit-logs` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `AUDIT_LOGS_VIEW`; decide whether ADMIN should keep this. | High |
| `apps/api/src/admin/admin.controller.ts` | `GET /api/admin/organization` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_VIEW`; keep role until organization visibility delegation is reviewed. | Medium |
| `apps/api/src/admin/admin.controller.ts` | `GET /api/admin/organization/branches/:vendorId` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_VIEW`; service exposes org branch context. | Medium |
| `apps/api/src/admin/admin.controller.ts` | `POST /api/admin/organization/branches/:vendorId/assign-picker` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add policy only after confirming transfer delegation; service routes active reassignment into Transfer workflow or rejects direct creation. | Critical |
| `apps/api/src/admin/admin.controller.ts` | `POST /api/admin/organization/branches/:vendorId/replace-champ` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS`; review direct assignment mutation safety. | High |
| `apps/api/src/admin/admin.controller.ts` | `POST /api/admin/organization/chains/:chainId/replace-area-manager` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Endpoint returns service guidance today; add policy if route remains. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/status` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Status is admin-only; add `ASSIGNMENTS_VIEW` if retained. | Low |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/picker/:pickerId/current` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`; service validates target is Picker. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/vendor/:vendorId/champ/current` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/chain/:chainId/area-manager/current` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/pickers` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/vendor-champs` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `GET /api/assignments/chain-area-managers` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ASSIGNMENTS_VIEW`. | Medium |
| `apps/api/src/assignments/assignments.controller.ts` | `POST /api/assignments/picker-branch` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Route intentionally rejects direct Picker assignment; keep guard and add policy only if endpoint remains. | Critical |
| `apps/api/src/assignments/assignments.controller.ts` | `POST /api/assignments/vendor-champ` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS`; service target-role checks stay. | High |
| `apps/api/src/assignments/assignments.controller.ts` | `POST /api/assignments/chain-area-manager` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS`; consider migrating users profile path as canonical. | High |
| `apps/api/src/assignments/assignments.controller.ts` | `PATCH /api/assignments/picker-branch/:id/close` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Route intentionally rejects direct Picker assignment close; keep guard and service rejection. | Critical |
| `apps/api/src/assignments/assignments.controller.ts` | `PATCH /api/assignments/vendor-champ/:id/close` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_CHAMP_ASSIGNMENTS`; service status/audit checks stay. | High |
| `apps/api/src/assignments/assignments.controller.ts` | `PATCH /api/assignments/chain-area-manager/:id/close` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_AREA_MANAGER_ASSIGNMENTS`; prefer users profile path for Area Manager chain assignment. | High |
| `apps/api/src/chains/chains.controller.ts` | `GET /api/chains/status` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_VIEW`; decide whether status should remain admin-only. | Low |
| `apps/api/src/chains/chains.controller.ts` | `GET /api/chains` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_VIEW`; review custom delegation because service is global. | Medium |
| `apps/api/src/chains/chains.controller.ts` | `GET /api/chains/:id` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_VIEW`. | Medium |
| `apps/api/src/chains/chains.controller.ts` | `POST /api/chains` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_CHAINS`; keep audit. | High |
| `apps/api/src/chains/chains.controller.ts` | `PATCH /api/chains/:id` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` class | none | Hybrid for now | Add `ORGANIZATION_MANAGE_CHAINS`; keep audit. | High |
| `apps/api/src/vendors/vendors.controller.ts` | `GET /api/vendors/status` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add `ORGANIZATION_VIEW`; review visibility scope. | Low |
| `apps/api/src/vendors/vendors.controller.ts` | `GET /api/vendors` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add `ORGANIZATION_VIEW`; service currently lists globally. | Medium |
| `apps/api/src/vendors/vendors.controller.ts` | `GET /api/vendors/:id` | `JwtAuthGuard`, `RolesGuard` | `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add `ORGANIZATION_VIEW`; review scope before allowing custom grants to Pickers. | Medium |
| `apps/api/src/vendors/vendors.controller.ts` | `POST /api/vendors` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add `ORGANIZATION_MANAGE_BRANCHES`; keep role until custom delegation approved. | High |
| `apps/api/src/vendors/vendors.controller.ts` | `PATCH /api/vendors/:id` | `JwtAuthGuard`, `RolesGuard` | `ADMIN`, `SUPER_ADMIN` | none | Hybrid for now | Add `ORGANIZATION_MANAGE_BRANCHES`; keep audit. | High |
| `apps/api/src/auth/auth.controller.ts` | `POST /api/auth/logout` | `JwtAuthGuard` | none | none | Not authorization | Session endpoint; do not add role policy. | Low |
| `apps/api/src/auth/auth.controller.ts` | `POST /api/auth/change-password` | `JwtAuthGuard` | none | none | Not authorization | Own credential endpoint; controlled by auth/session and password validation. | Medium |
| `apps/api/src/auth/auth.controller.ts` | `GET /api/auth/me` | `JwtAuthGuard` | none | none | Not authorization | Session identity endpoint; do not block by custom permissions. | Low |
| `apps/api/src/*/*.controller.ts` | `GET */status`, `GET /api/health`, `POST /api/auth/login` | mixed/public | none or class-level roles | none | Not authorization | Public or existing admin-only health/foundation status; do not force into policy unless product requires. | Low |

## Convert to Policy-only Candidates

Exact endpoints that can move to policy-only first:

- `apps/api/src/access-control/access-control.controller.ts`
  - `GET /api/access-control/overview`
  - `GET /api/access-control/roles`
  - `GET /api/access-control/roles/:id`
  - `POST /api/access-control/roles`
  - `PATCH /api/access-control/roles/:id`
  - `POST /api/access-control/roles/:id/deactivate`
  - `POST /api/access-control/roles/:id/permissions/sync`
  - `GET /api/access-control/effective-permissions/users/:id`
  - Why: all use system-only, non-assignable access-control permissions owned by Super Admin in the matrix. `@Roles(UserRole.SUPER_ADMIN)` is redundant once a permission guard exists.

- `apps/api/src/users/users.controller.ts`
  - `GET /api/users/:id/access-role-assignments`
  - `POST /api/users/:id/access-role-assignments`
  - `POST /api/users/:id/access-role-assignments/:assignmentId/revoke`
  - Why: all use system-only access-control assignment/effective-permission permissions and service-level validation/audit/cache refresh.

- Already policy-only routes that should stay that way:
  - `GET /api/users/me`
  - `PATCH /api/users/me/preferences`
  - `GET /api/users/:id/operational-profile`
  - `POST /api/users/:id/reveal-temporary-password`
  - `POST /api/users/:id/reset-temporary-password`
  - `GET /api/requests`
  - `GET /api/requests/my/submitted`
  - `GET /api/requests/:id`
  - `POST /api/requests/new-hire`
  - `POST /api/requests/offboarding`
  - `POST /api/requests/transfer`
  - `POST /api/requests/:id/submit`
  - `POST /api/requests/:id/cancel`
  - `POST /api/approvals/:approvalId/approve`
  - `POST /api/approvals/:approvalId/reject`
  - `GET /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`

## Keep Role/Persona Guard Candidates

These routes should keep `@Roles` or an equivalent persona guard because response shape or service semantics assume the actor's `User.role`:

- `apps/api/src/workspaces/workspaces.controller.ts`
  - `GET /api/workspaces/picker`
  - `GET /api/workspaces/champ`
  - `GET /api/workspaces/champ/branches`
  - `GET /api/workspaces/champ/branches/:vendorId`
  - `GET /api/workspaces/area-manager`
  - `GET /api/workspaces/admin`
  - Reason: workspace endpoints are persona/workspace boundaries, not just permissions.

- `apps/api/src/reports/reports.controller.ts`
  - `GET /api/reports/admin/overview`
  - `GET /api/reports/area-manager/overview`
  - `GET /api/reports/champ/overview`
  - Reason: endpoint response shape and scope use the actor's persona. Custom role grants should not make a Picker an Area Manager report subject.

- `apps/api/src/users/users.controller.ts`
  - `GET /api/users/me/profile-completion`
  - `PATCH /api/users/me/profile-completion`
  - Reason: Picker-only profile-completion workflow. `UsersService.getPickerForProfileCompletion()` also validates `user.role === PICKER`.

## Hybrid / High-risk Candidates

Keep `@Roles` while adding or preserving policy gates:

- Request lookup/search helpers:
  - `GET /api/requests/offboarding/pickers`
  - `GET /api/requests/offboarding/eligible-users`
  - `POST /api/requests/new-hire/lookup-candidate`
  - Reason: these are pre-create workflow helpers. Add dynamic policy using existing create permissions, but keep workflow role/target validation.

- Finalization:
  - `POST /api/requests/:id/finalize-new-hire`
  - `POST /api/requests/:id/finalize-offboarding`
  - Reason: `APPROVALS_DECIDE_FINAL_LIFECYCLE` is assignable and critical. Keep Admin/Super Admin perimeter until product explicitly permits custom delegation and finalization services are reviewed.

- Users admin/assignment operations:
  - `GET /api/users`
  - `GET /api/users/operational-list`
  - `GET|POST|DELETE /api/users/:id/area-manager-chain-assignments...`
  - `PATCH /api/users/:id/admin-profile`
  - Reason: services are admin-shaped or operational-assignment-sensitive.

- Admin/organization/assignment management:
  - all `apps/api/src/admin/admin.controller.ts` routes
  - all `apps/api/src/assignments/assignments.controller.ts` routes
  - all `apps/api/src/chains/chains.controller.ts` routes
  - all `apps/api/src/vendors/vendors.controller.ts` routes
  - Reason: several existing permission keys fit, but service visibility and mutation semantics need a route-by-route review before custom grants can bypass role metadata.

## Missing Permission Keys

Recommended new permission decisions before migration:

1. `APPROVALS_VIEW_PENDING`
   - For `GET /api/approvals/pending`.
   - Existing service filters to actionable approvals, but the route has no policy gate.

2. `REQUESTS_CREATE_GENERIC` or deprecate `POST /api/requests`
   - Generic request creation is not part of the active workflow families and currently has no policy check.
   - Prefer deprecation if all active workflow families use specialized endpoints.

3. `ADMIN_PENDING_ACTIONS_VIEW` or `REQUESTS_FINALIZATION_QUEUE_VIEW`
   - For `GET /api/admin/pending-actions`.
   - Existing `REQUESTS_VIEW` is too broad if the endpoint is specifically an Admin action queue.

Possible but not recommended yet:

- `WORKSPACES_VIEW_PICKER`, `WORKSPACES_VIEW_CHAMP`, `WORKSPACES_VIEW_AREA_MANAGER`, `WORKSPACES_VIEW_ADMIN`.
- These would confuse permission with persona. Keep `@Roles` for workspace routes unless product explicitly wants cross-persona workspace viewing.

## Missing Policy Coverage

Routes using `@Roles` but no `AccessPolicyService` check:

- `apps/api/src/workspaces/workspaces.controller.ts`
  - Acceptable intentionally: persona/workspace perimeter.

- `apps/api/src/admin/admin.controller.ts`
  - Not acceptable long-term. Add policy coverage in later phases, route by route.

- `apps/api/src/assignments/assignments.controller.ts`
  - Not acceptable long-term. Add policy coverage, but do not change rejection behavior for direct Picker assignment routes.

- `apps/api/src/chains/chains.controller.ts`
  - Not acceptable long-term. Existing organization permissions can cover these routes.

- `apps/api/src/vendors/vendors.controller.ts`
  - Not acceptable long-term. Existing organization permissions can cover these routes, but visibility scope should be reviewed.

- `apps/api/src/requests/requests.controller.ts`
  - `GET /api/requests/offboarding/pickers`
  - `GET /api/requests/offboarding/eligible-users`
  - `POST /api/requests/new-hire/lookup-candidate`
  - Not acceptable long-term; use existing dynamic create permissions as read/preflight gates.

Routes with no `@Roles` and no `AccessPolicyService`:

- `GET /api/approvals/pending`
  - Add pending-approval view permission.

- `POST /api/requests`
  - Deprecate or add generic create permission.

- Auth/session endpoints:
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
  - `GET /api/auth/me`
  - Acceptable: these are authenticated session/self-service endpoints, not role authorization.

- Public/foundation status endpoints and health:
  - Acceptable if intentionally public or class-protected. Do not force public health into policy authorization.

## Service-level Role Logic That Must Stay

Do not replace these with route-level permission checks:

- `apps/api/src/requests/requests.service.ts`
  - `canViewRequest`, request visibility where-building, `userCanActOnStep`, and `isAdmin`.
  - Why: request visibility, assignment scope, approval ownership/current step, and Admin final step logic.

- `apps/api/src/approvals/approvals.service.ts`
  - `listPending`, `assertCanDecide`, `assertApprovalDecisionPermission`.
  - Why: pending approval filtering and decision ownership/current-step/status checks.

- `apps/api/src/requests/workflows/new-hire-workflow.service.ts`
  - creator/target-role rules, branch context, Area Manager Shopper ID capture, assignment scope.
  - Why: New Hire business workflow.

- `apps/api/src/requests/workflows/offboarding-workflow.service.ts`
  - `assertCanUseOffboarding`, target-role restrictions, block-decision requirements.
  - Why: Resignation workflow business rules.

- `apps/api/src/requests/workflows/transfer-workflow.service.ts`
  - Champ/Area Manager/Admin transfer eligibility and Branch/Chain scope.
  - Why: Transfer is Picker-only and assignment-scope-sensitive.

- `apps/api/src/users/users.service.ts`
  - Area Manager target validation, temporary password target/scope checks, profile-completion Picker validation, operational profile scope.
  - Why: target-user safety, scope, and persona-specific behavior.

- `apps/api/src/assignments/assignments.service.ts` and `apps/api/src/admin/admin.service.ts`
  - `assertUserRole` checks for Picker, Champ, Area Manager.
  - Why: validates target users for operational assignment records.

- `apps/api/src/reports/reports.service.ts`
  - role filters in aggregate queries.
  - Why: report subject classification and persona-specific metrics, not route authorization.

- `apps/api/src/auth/auth.service.ts`
  - Picker profile status/login redirect behavior.
  - Why: session and workspace routing.

## Route-level Conflicts

Current `@Roles` blocks custom permission grants on these routes even when `AccessPolicyService` would allow the permission:

- `GET /api/users` and `GET /api/users/operational-list` with `USERS_LIST_OPERATIONAL`.
- `PATCH /api/users/:id/admin-profile` with `USERS_EDIT_PROFILE`.
- Area Manager Chain assignment endpoints with `USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS`.
- Request finalization endpoints with `APPROVALS_DECIDE_FINAL_LIFECYCLE`.
- Reports endpoints with report-view permissions.
- Organization, Chain, Vendor, Admin, and Assignment routes once policy checks are added.

Some conflicts are intentional:

- Workspace endpoints must remain persona-specific.
- Picker profile-completion endpoints must remain Picker-specific.
- Access-control endpoints use system-only permissions, so `@Roles(SUPER_ADMIN)` is redundant but not blocking any assignable custom grant.

## Recommended Phase 8B Design

Choose option C: add both a static permission decorator/guard and keep manual asserts for dynamic permissions.

Recommended shape:

1. Add a `@RequirePermission(PermissionKey)` decorator and `PermissionGuard` for static route permissions.
2. Keep `accessPolicy.assertCan(...)` manual checks for dynamic permissions:
   - New Hire target-role mapping.
   - Resignation target-role mapping.
   - Approval step authority mapping.
   - Any route whose permission depends on DTO/query/path state.
3. Migrate low-risk static routes first:
   - Access Control controller.
   - Notifications controller if useful for consistency.
   - User custom access-role assignment routes.
4. Add policy coverage but keep `@Roles` for hybrid routes:
   - Admin/organization/assignments/chains/vendors.
   - Request search/lookup helpers.
   - Finalization endpoints.
5. Remove `@Roles` only after tests prove:
   - Permission grants work as intended.
   - Service-level scope/target/workflow validation still blocks unsafe actions.
   - Persona-specific routes still retain persona boundaries.

Do not replace all service-level role logic. Route authorization perimeter, workflow business rules, assignment/scope filtering, response shaping, and persona/workspace routing are separate layers.

## Required Tests for 8B/8C

Controller/guard tests:

- Permission metadata tests for `@RequirePermission`.
- PermissionGuard tests for allow/deny and missing metadata behavior.
- Tests proving `@Roles` removal from access-control routes does not allow Admin.
- Tests proving custom grants can access selected policy-only routes when intended.

Policy integration tests:

- Users list/profile/temp-password/assignment routes.
- Requests list/create/search/finalize/submit/cancel routes.
- Approvals pending/approve/reject routes.
- Reports role/persona routes.
- Notifications self-service routes.
- Access-control custom-role management and user assignment routes.
- Admin/organization/chain/vendor/assignment routes after policy coverage is added.

Workflow regression tests:

- New Hire policy, approval, rehire, and finalization tests.
- Offboarding policy, approval/finalization, and payload tests.
- Transfer workflow tests.
- Request approval routing tests.
- Users Area Manager Chain assignment tests.

Security/regression tests:

- Admin cannot access Super Admin access-control routes.
- Picker custom grant does not create workspace/persona access.
- Custom permissions do not bypass assignment-table scope.
- Custom permissions do not bypass Request -> Approval -> System applies change.
- Direct Picker assignment endpoints still reject direct lifecycle bypass.
- Approval ownership/currentStep/status checks still run after permission allow.

## Risks

- Custom role overgranting if `@Roles` is removed before services are scope-safe for non-base-role actors.
- Workflow bypass if route permission is treated as enough for lifecycle mutation.
- Losing persona separation by turning workspace routes into generic permission routes.
- Accidental Admin access to Super Admin-only access-control routes if system-only permissions are mishandled.
- Removing `@Roles` too early from role-shaped report/workspace/profile-completion endpoints.
- Tests giving false confidence from direct controller mocks that bypass Nest guard ordering.
- High-risk assignable permissions such as final lifecycle decisions and temporary password controls need service-level target checks forever.
- Organization and assignment endpoints have broad/global service responses; custom grants could expose more data than intended if policy-only migration happens before scope review.

## Final Recommendation

Start Phase 8B with a small guard/decorator foundation and static-route migration only.

Recommended first slice:

1. Add `@RequirePermission` and `PermissionGuard`.
2. Migrate Access Control routes from manual/static `assertCan` to decorator-based policy guard while keeping behavior unchanged.
3. Keep `@Roles` on all persona/workspace, report, finalization, admin/organization, and assignment routes.
4. Add policy coverage to missing high-risk helper routes in later, separate slices.

Do not proceed with broad `@Roles` removal. The right migration is route-by-route and must preserve service-level workflow and assignment-scope checks.
