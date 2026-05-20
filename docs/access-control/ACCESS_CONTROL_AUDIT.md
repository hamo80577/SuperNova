# Access Control Audit

Phase 0 audit for Access Control V1 on branch `feature/access-control-v1`.

This audit is based on direct local inspection of the current repository. It is
docs-only and does not change code, schema, UI, workflow behavior, or the
existing planning documents.

## 1. Current Access-Control Summary

SuperNova currently uses `User.role` and the Prisma `UserRole` enum as the
primary access-control primitive. Backend coarse route access is enforced with
`JwtAuthGuard`, `RolesGuard`, and `@Roles(...)`, while service methods apply
additional role-specific decisions for workflow creation, approval decisions,
profile visibility, credential access, reporting, and assignment management.

Operational scope is not stored directly on `User`. The current Prisma schema
keeps scope in assignment tables:

- `PickerBranchAssignment`
- `VendorChampAssignment`
- `ChainAreaManagerAssignment`

This matches the product rule that `managerId`, `vendorId`, and `chainId`
must not become source-of-truth fields on `User`.

Lifecycle changes are mostly workflow-based:

- New Hire creates users and Picker/Champ assignments only through request
  finalization.
- Resignation archives/deactivates users and closes active assignments only
  through request finalization.
- Transfer applies Picker branch movement through the transfer workflow.
- Direct Picker assignment creation and direct Picker assignment closure are
  explicitly rejected by `AssignmentsService`.

The current access model is therefore a working hybrid:

- Role-based UX and coarse backend perimeter.
- Assignment-based operational scope.
- Workflow-based lifecycle mutation.
- Hardcoded role-based business authority inside several services.

## 2. High-Risk Hardcoded Role Coupling

- `apps/api/src/requests/request-approval-routing.service.ts`
  - `resolveAreaManagerStep()` queries `ChainAreaManagerAssignment` with
    `areaManager.role: UserRole.AREA_MANAGER`.
  - It returns `approverRole: UserRole.AREA_MANAGER`.
  - This makes chain approval authority inseparable from the concrete
    `AREA_MANAGER` role.

- `apps/api/src/requests/requests.service.ts`
  - `generateApprovalSteps()` creates `ADMIN_FINAL_APPROVAL` with
    `approverRole: UserRole.ADMIN`.
  - `userCouldOwnApproval()` treats `ADMIN_FINAL_APPROVAL` as
    `isAdmin(user)` and all non-admin approval steps as `UserRole.AREA_MANAGER`
    plus Chain assignment scope.
  - Request visibility uses `isAdmin(user)` for global visibility.

- `apps/api/src/approvals/approvals.service.ts`
  - `listPending()` gives Admin/Super Admin users `ADMIN_FINAL_APPROVAL`
    approvals and otherwise filters by `approverRole: currentUser.role`.
  - Decision authority delegates to `RequestsService.userCanActOnStep()`,
    preserving the same hardcoded Admin/Area Manager model.

- `apps/api/src/requests/workflows/new-hire-approval.service.ts`
  - Area Manager approval requires `actor.role === UserRole.AREA_MANAGER`.
  - Admin final notification targets users with roles
    `[UserRole.ADMIN, UserRole.SUPER_ADMIN]`.

- `apps/api/src/requests/workflows/offboarding-approval.service.ts`
  - Resignation Area Manager approval requires
    `actor.role === UserRole.AREA_MANAGER`.
  - Admin final notification targets users with roles
    `[UserRole.ADMIN, UserRole.SUPER_ADMIN]`.

- `apps/api/src/requests/workflows/transfer-workflow.service.ts`
  - Transfer creation is limited to `CHAMP`, `AREA_MANAGER`, or `isAdmin()`.
  - Source and destination approval authority is resolved through
    `AREA_MANAGER` approval steps.
  - `userCouldOwnApproval()` again requires `UserRole.AREA_MANAGER` for
    chain approval steps.

- `apps/api/src/users/users.service.ts`
  - Operational profile credential controls rely on hardcoded Admin,
    Champ, and Area Manager roles.
  - `assertCanManagePassword()` contains sensitive credential authority tied to
    concrete roles. It includes a partial Admin/Super Admin split for Admin
    password reset, but the broader permission is still role-coupled.

- `apps/api/src/reports/reports.controller.ts` and
  `apps/api/src/reports/reports.service.ts`
  - Global admin reporting is guarded by Admin/Super Admin roles.
  - Area Manager and Champ reports are tied to role-specific endpoints and
    assignment scopes.
  - Reporting is a likely early migration target because it controls broad
    visibility.

## 3. Medium-Risk Hardcoded Role Coupling

- `apps/api/src/requests/workflows/new-hire-workflow.policy.ts`
  - Creator-to-target rules are hardcoded:
    - Champ -> Picker
    - Area Manager -> Picker or Champ
    - Admin/Super Admin -> Picker, Champ, or Area Manager
  - This correctly reflects current product rules, but should eventually be
    represented as permission plus scope policy.

- `apps/api/src/requests/workflows/offboarding-workflow.policy.ts`
  - Resignation target rules are hardcoded with the same Champ, Area Manager,
    Admin, and Super Admin role assumptions.
  - This is acceptable for the active Resignation scope, but will need policy
    migration before new authority roles are added.

- `apps/api/src/users/users.service.ts`
  - `getAreaManagerChainAssignments()` and related mutation helpers require
    the target user to be `UserRole.AREA_MANAGER`.
  - Operational list context mapping branches by `PICKER`, `CHAMP`, and
    `AREA_MANAGER`.
  - List filters use role-specific assignment relations.

- `apps/api/src/admin/admin.controller.ts` and
  `apps/api/src/admin/admin.service.ts`
  - The whole admin controller perimeter is `@Roles(UserRole.ADMIN,
    UserRole.SUPER_ADMIN)`.
  - Organization operations such as replacing a Branch Champ are available to
    both Admin and Super Admin.
  - Direct Picker branch assignment remains blocked, which is a guardrail to
    preserve.

- `apps/api/src/assignments/assignments.controller.ts` and
  `apps/api/src/assignments/assignments.service.ts`
  - Assignment endpoints are guarded by Admin/Super Admin together.
  - Champ and Area Manager assignment creation validates target users by
    concrete role.
  - Direct Picker assignment creation/closure rejection is correct and should
    remain workflow-based.

- `apps/api/src/notifications/notifications.service.ts`
  - `notifyAdmins()` uses a hardcoded role list `["ADMIN", "SUPER_ADMIN"]`.
  - This is simple today, but future notification targeting should use an
    authority or permission such as lifecycle final approval.

- `apps/api/src/auth/auth.service.ts`
  - Login redirect mapping sends `ADMIN` and `SUPER_ADMIN` to the same
    `/admin/dashboard` destination.
  - This is acceptable UX compatibility now, but it hides the future system
    owner distinction.

- `apps/web/components/dashboard/role-nav.ts`
  - Admin and Super Admin navigation are effectively duplicated.
  - No `/super-admin/access-control` navigation exists yet, which is correct
    for Phase 0, but it confirms the future split work.

- `apps/web/components/users/users-area-page.tsx` and
  `apps/web/components/users/users-actions-menu.tsx`
  - Users page sections, filters, Transfer action, and Resignation action
    availability are role-driven.
  - This is a UX mirror of backend policy and must not be treated as the
    source of authority.

## 4. Acceptable Role Perimeter Checks

These checks are acceptable to preserve during Access Control V1 foundation
work:

- `apps/api/src/auth/guards/roles.guard.ts`
  - Coarse `@Roles(...)` enforcement remains a valid route perimeter.

- `apps/api/src/auth/decorators/roles.decorator.ts`
  - The `@Roles` decorator is compatibility infrastructure and should remain.

- `apps/api/src/workspaces/workspaces.controller.ts`
  - Role-specific workspace routes for Picker, Champ, Area Manager, and
    Admin/Super Admin are acceptable persona routing.

- `apps/api/src/users/users.controller.ts`
  - Picker-only profile completion endpoints are acceptable because profile
    completion is currently a Picker workflow.

- `apps/api/src/requests/requests.controller.ts`
  - Coarse route guards for lookup/finalization are acceptable when service
    methods still enforce workflow state and scope.

- `apps/web/components/auth/protected-route.tsx`
  - Frontend `allowedRoles` is acceptable as UX routing only.

- `apps/web/lib/auth/role-redirects.ts`
  - Role redirects and labels are acceptable as workspace/persona behavior.

- `apps/web/components/dashboard/dashboard-frame.tsx`
  - Allowing `SUPER_ADMIN` to enter the Admin dashboard through frontend
    compatibility is acceptable until the Admin/Super Admin split phase.

## 5. Good Assignment-Scope Patterns to Preserve

- `prisma/schema.prisma`
  - `User` has `role` but no source-of-truth `managerId`, `vendorId`, or
    `chainId` fields.
  - Assignment scope is represented by `PickerBranchAssignment`,
    `VendorChampAssignment`, and `ChainAreaManagerAssignment`.

- `apps/api/src/requests/request-approval-routing.service.ts`
  - Approval routing uses active `ChainAreaManagerAssignment` rows and checks
    account, employment, and block state before selecting an approver.
  - The role name is risky, but the assignment-scope pattern is good.

- `apps/api/src/workspaces/workspaces.service.ts`
  - Picker workspace reads active Picker branch assignment.
  - Champ workspace reads active Vendor-Champ assignments.
  - Area Manager workspace reads active Chain-Area Manager assignments.

- `apps/api/src/requests/requests.service.ts`
  - Request visibility for Champ and Area Manager users is based on active
    Vendor/Chain assignment scope.

- `apps/api/src/requests/workflows/new-hire-candidate.service.ts`
  - New Hire lookup enforces Champ Branch scope and Area Manager Chain scope.

- `apps/api/src/requests/workflows/offboarding-search.service.ts` and
  `apps/api/src/requests/workflows/offboarding-target.service.ts`
  - Resignation search and target resolution are assignment-scoped.

- `apps/api/src/requests/workflows/transfer-workflow.service.ts`
  - Transfer validates active Picker source assignment, source Branch scope,
    destination Branch, cross-chain approvals, and pending duplicate requests.

- `apps/api/src/users/users.service.ts`
  - Operational profile permissions use `isActivePickerInChampScope()` and
    `isUserInAreaManagerScope()` for non-admin access.
  - Operational list filters use assignment relations instead of User fields.

- `apps/api/src/reports/reports.service.ts`
  - Area Manager reports derive scope from active Chain assignments.
  - Champ reports derive scope from active Vendor assignments.

## 6. Admin vs Super Admin Coupling Found

Admin and Super Admin are currently coupled as near-equivalent operational
admins in many places:

- `apps/api/src/users/users.service.ts`
  - `isAdmin()` returns true for both `ADMIN` and `SUPER_ADMIN`.
  - Admin/Super Admin both get profile edit, operational profile, and most
    credential management powers.
  - A partial split exists: Admin users cannot reset Admin passwords unless
    the actor is Super Admin, and Super Admin passwords cannot be reset through
    that path.

- `apps/api/src/requests/requests.service.ts`
  - `isAdmin()` gives both roles broad request visibility, submit/cancel power,
    and admin final approval authority.

- `apps/api/src/requests/workflows/new-hire-finalization.service.ts`
  - New Hire finalization accepts both roles through `isAdmin()`.

- `apps/api/src/requests/workflows/offboarding-finalization.service.ts`
  - Resignation finalization accepts both roles through `isAdmin()`.

- `apps/api/src/admin/admin.controller.ts`
  - All admin routes are guarded by `@Roles(UserRole.ADMIN,
    UserRole.SUPER_ADMIN)`.

- `apps/api/src/assignments/assignments.controller.ts`
  - All assignment routes are guarded by `@Roles(UserRole.ADMIN,
    UserRole.SUPER_ADMIN)`.

- `apps/api/src/workspaces/workspaces.controller.ts`
  - Admin workspace is shared by Admin and Super Admin.

- `apps/api/src/reports/reports.controller.ts`
  - Admin reports are shared by Admin and Super Admin.

- `apps/api/src/notifications/notifications.service.ts`
  - Admin notification targeting includes both Admin and Super Admin.

- `apps/web/lib/auth/role-redirects.ts`,
  `packages/shared/src/index.ts`, and
  `apps/web/components/dashboard/role-nav.ts`
  - Admin and Super Admin route to and largely see the same workspace.

This coupling is expected before Phase 4, but it must be made explicit before
permissions are introduced so operational Admin and system owner authority do
not remain conceptually identical.

## 7. Approval Authority Coupling Found

Approval authority is currently coupled to role names at persistence,
routing, listing, and decision time:

- `prisma/schema.prisma`
  - `RequestApproval.approverRole` stores `UserRole`.
  - `Request.currentStep` and `RequestApproval.step` use `ApprovalStep`.

- `apps/api/src/requests/request-approval-routing.service.ts`
  - `GeneratedApprovalStep` includes `approverRole: UserRole`.
  - Area Manager steps resolve only to users with `UserRole.AREA_MANAGER`.

- `apps/api/src/requests/requests.service.ts`
  - Generated non-transfer requests always create an Area Manager step and an
    Admin final step.
  - Admin final step uses `approverRole: UserRole.ADMIN`.
  - `userCouldOwnApproval()` maps step authority back to Admin or Area Manager
    role checks.

- `apps/api/src/requests/workflows/new-hire-request-creation.service.ts`
  - New Hire approval records are created with `approverRole:
    UserRole.AREA_MANAGER` and `approverRole: UserRole.ADMIN`.

- `apps/api/src/requests/workflows/offboarding-request-creation.service.ts`
  - Resignation approval records are created with `approverRole:
    UserRole.AREA_MANAGER` and `approverRole: UserRole.ADMIN`.

- `apps/api/src/requests/workflows/transfer-workflow.service.ts`
  - Source and destination approval steps are named Area Manager steps and
    resolved through Area Manager assignment authority.

- `apps/api/src/approvals/approvals.service.ts`
  - Pending approvals are queried by `approverRole` for non-admin users.

The recommended future abstraction is authority over existing step names, not
renaming `ApprovalStep`:

- `AREA_MANAGER_APPROVAL` -> chain authority approval
- `SOURCE_AREA_MANAGER_APPROVAL` -> source chain authority approval
- `DESTINATION_AREA_MANAGER_APPROVAL` -> destination chain authority approval
- `ADMIN_FINAL_APPROVAL` -> final lifecycle authority

## 8. Workflow Guardrails That Must Not Be Broken

- Do not bypass New Hire finalization.
  - `NewHireFinalizationService` requires Admin final workflow state and is
    responsible for creating users and Picker/Champ assignments.

- Do not bypass Resignation finalization.
  - `OffboardingFinalizationService` requires Admin final workflow state,
    confirmation, closes active assignments, archives/deactivates users, and
    applies block decisions.

- Do not bypass Transfer workflow.
  - `TransferWorkflowService` validates Picker-only transfer, active source
    assignment, destination Branch, duplicate pending requests, and source or
    destination chain approvals.

- Do not add direct Picker assignment mutation.
  - `AssignmentsService.rejectDirectPickerBranchAssignmentCreate()` and
    `rejectDirectPickerBranchAssignmentClose()` correctly force New Hire,
    Resignation, or Transfer workflows.

- Do not weaken Shopper ID handling.
  - Picker New Hire requires Shopper ID through the approved workflow path.
  - Champ and Area Manager New Hire must not receive Shopper ID.

- Do not expose raw temporary passwords through notifications.
  - Temporary password reveal/reset remains behind authorized profile
    credential controls in `UsersService`.

- Do not remove request state machine checks.
  - Workflow services use request status/current-step checks and
    `assertRequestTransition()` before moving requests forward.

- Do not turn frontend role checks into authority.
  - Frontend menus and routes are convenience UX only; backend workflow,
    scope, and approval checks must remain authoritative.

## 9. Recommended Next Phase

Proceed to Phase 1: Permission Catalog.

The next phase should add code-only permission definitions with no behavior
change, no database migration, and no custom roles UI. Suggested initial
permission groups:

- Workspace visibility
- Request creation
- Approval decision authority
- Lifecycle finalization
- Operational profile visibility
- Credential management
- Assignment administration
- Reports visibility
- Notifications targeting
- Audit visibility
- Access-control/system ownership

Phase 1 should not replace `User.role`, `RolesGuard`, `@Roles`,
`ApprovalStep`, or `RequestApproval.approverRole`. It should only create the
catalog that later phases can map to current roles and policies.

## 10. Files Inspected

Planning and repo docs read:

- `docs/REPO_INDEX.md`
- `docs/access-control/README.md`
- `docs/access-control/ACCESS_CONTROL_V1.md`
- `docs/access-control/IMPLEMENTATION_PLAN.md`
- `docs/access-control/AGENT_BRIEF.md`

Schema inspected:

- `prisma/schema.prisma`

Required backend directories enumerated and searched:

- `apps/api/src/auth`
- `apps/api/src/users`
- `apps/api/src/workspaces`
- `apps/api/src/requests`
- `apps/api/src/approvals`
- `apps/api/src/admin`
- `apps/api/src/assignments`
- `apps/api/src/reports`
- `apps/api/src/notifications`

Required frontend directories enumerated and searched:

- `apps/web/lib/auth`
- `apps/web/components/auth`
- `apps/web/components/dashboard`
- `apps/web/components/users`

Key backend files read or inspected with targeted searches:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/account-access.utils.ts`
- `apps/api/src/auth/decorators/roles.decorator.ts`
- `apps/api/src/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/auth/types/authenticated-user.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/users/temporary-password.service.ts`
- `apps/api/src/workspaces/workspaces.controller.ts`
- `apps/api/src/workspaces/workspaces.service.ts`
- `apps/api/src/requests/requests.controller.ts`
- `apps/api/src/requests/requests.service.ts`
- `apps/api/src/requests/request-approval-routing.service.ts`
- `apps/api/src/requests/request-status-machine.ts`
- `apps/api/src/requests/workflows/new-hire-workflow.policy.ts`
- `apps/api/src/requests/workflows/new-hire-workflow.service.ts`
- `apps/api/src/requests/workflows/new-hire-request-creation.service.ts`
- `apps/api/src/requests/workflows/new-hire-candidate.service.ts`
- `apps/api/src/requests/workflows/new-hire-approval.service.ts`
- `apps/api/src/requests/workflows/new-hire-finalization.service.ts`
- `apps/api/src/requests/workflows/offboarding-workflow.policy.ts`
- `apps/api/src/requests/workflows/offboarding-workflow.service.ts`
- `apps/api/src/requests/workflows/offboarding-search.service.ts`
- `apps/api/src/requests/workflows/offboarding-target.service.ts`
- `apps/api/src/requests/workflows/offboarding-request-creation.service.ts`
- `apps/api/src/requests/workflows/offboarding-approval.service.ts`
- `apps/api/src/requests/workflows/offboarding-finalization.service.ts`
- `apps/api/src/requests/workflows/transfer-workflow.service.ts`
- `apps/api/src/approvals/approvals.controller.ts`
- `apps/api/src/approvals/approvals.service.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/assignments/assignments.controller.ts`
- `apps/api/src/assignments/assignments.service.ts`
- `apps/api/src/reports/reports.controller.ts`
- `apps/api/src/reports/reports.service.ts`
- `apps/api/src/notifications/notifications.controller.ts`
- `apps/api/src/notifications/notifications.service.ts`

Key frontend files read or inspected with targeted searches:

- `apps/web/lib/auth/types.ts`
- `apps/web/lib/auth/role-redirects.ts`
- `apps/web/lib/auth/api-client.ts`
- `apps/web/components/auth/auth-provider.tsx`
- `apps/web/components/auth/protected-route.tsx`
- `apps/web/components/auth/login-form.tsx`
- `apps/web/components/auth/change-password-form.tsx`
- `apps/web/components/dashboard/role-nav.ts`
- `apps/web/components/dashboard/dashboard-frame.tsx`
- `apps/web/components/dashboard/dashboard-layout.tsx`
- `apps/web/components/dashboard/dashboard-shell-utils.ts`
- `apps/web/components/dashboard/dashboard-user-menu.tsx`
- `apps/web/components/users/users-area-page.tsx`
- `apps/web/components/users/users-actions-menu.tsx`
- `apps/web/components/users/users-toolbar.tsx`
- `apps/web/components/users/users-display-utils.ts`
- `apps/web/components/users/operational-user-profile-modal.tsx`
- `apps/web/components/users/admin-profile-edit-dialog.tsx`
- `apps/web/components/users/admin-profile-edit-validation.ts`
- `apps/web/components/users/password-access-dialog.tsx`

Additional related files inspected because they are referenced by the frontend
auth/users surfaces:

- `packages/shared/src/index.ts`
- `apps/web/lib/api/users.ts`
- `apps/web/lib/api/workspaces.ts`
- `apps/web/lib/api/requests.ts`
- `apps/web/lib/api/reports.ts`
- `apps/web/lib/api/notifications.ts`
