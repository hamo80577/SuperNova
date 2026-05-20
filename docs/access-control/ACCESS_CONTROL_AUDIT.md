# Access Control Audit

## 1. Current Access-Control Summary
SuperNova uses a role-based access control system (`UserRole` enum) with hardcoded roles (`PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN`). Route access is protected using a `@Roles` decorator combined with a `RolesGuard`. Operational scope is decoupled from the `User` record itself and relies entirely on assignment tables (`PickerBranchAssignment`, `VendorChampAssignment`, `ChainAreaManagerAssignment`). Lifecycle changes are protected by explicit workflow services (Requests and Approvals) that manage status transitions and finalizations.

## 2. High-Risk Hardcoded Role Coupling
- **Approval Routing:** `RequestApprovalRoutingService.resolveAreaManagerStep` queries specifically for users with `role: UserRole.AREA_MANAGER`. This completely breaks if another role (e.g., Operations Lead) needs authority over a Chain's approvals.
- **Approval Ownership Check:** `ApprovalsService.listPending` hardcodes that if the user is `ADMIN` or `SUPER_ADMIN`, they see `ADMIN_FINAL_APPROVAL` steps; otherwise, they only see steps where `approverRole === currentUser.role`.

## 3. Medium-Risk Hardcoded Role Coupling
- **User Service Assignment Logic:** `UsersService.getAreaManagerChainAssignments` strictly checks `user.role !== UserRole.AREA_MANAGER` before returning chain assignments, preventing any other role from being granted an operational chain scope.
- **Admin Profile Editing:** `UsersService.updateAdminProfile` explicitly relies on an `isAdmin()` check (coupling `ADMIN` and `SUPER_ADMIN`) to allow profile mutations.

## 4. Acceptable Role Perimeter Checks
- **Route Guards:** The `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` decorators on controllers (like `AdminController`) provide a good coarse-grained perimeter. This is safe to keep during the transition to permissions.
- **User Role Enum:** `User.role` remains the primary identifier for UI routing and persona selection, which is acceptable if decoupled from business logic decisions.

## 5. Good Assignment-Scope Patterns to Preserve
- **Decoupled User Scope:** `prisma.schema` correctly separates scope into `PickerBranchAssignment`, `VendorChampAssignment`, and `ChainAreaManagerAssignment`. There are no `vendorId` or `chainId` fields on the `User` model.
- **Active Assignment Enforcement:** `RequestApprovalRoutingService` and `UsersService` query for `status: AssignmentStatus.ACTIVE` and `employmentStatus: EmploymentStatus.ACTIVE` along with block statuses, ensuring only currently eligible users can act or be acted upon.

## 6. Admin vs Super Admin Coupling Found
- Admin and Super Admin are frequently coupled as functional equivalents across the backend. They share the same route guards (`@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)`).
- `ApprovalsService.listPending` groups them identically to fetch `ADMIN_FINAL_APPROVAL` tasks. This blocks treating Super Admin purely as a system owner distinct from operational Admins.

## 7. Approval Authority Coupling Found
- `RequestApproval.approverRole` hard-links an approval step to a specific `UserRole`.
- `ApprovalStep` enum (`AREA_MANAGER_APPROVAL`, `SOURCE_AREA_MANAGER_APPROVAL`, `DESTINATION_AREA_MANAGER_APPROVAL`) conceptually links the authority to the `AREA_MANAGER` role name, even though the step should ideally represent "chain-level authority".

## 8. Workflow Guardrails That Must Not Be Broken
- **Strict Finalization:** `ApprovalsService` delegates complex finalization to `RequestsService` (e.g., `finalizeNewHire`, `approveOffboardingAreaManagerApproval`). 
- **Request State Machine:** Direct mutations to a user's employment or account status do not exist on `UsersService`; they must pass through a Request workflow and transition statuses in order (e.g., `assertRequestTransition`).
- **Temporary Password Access:** Temporary password revealing/resetting is securely gated behind `mustChangePassword` and expiration times within `UsersService`, acting as a strict lifecycle barrier for new/rehired users.

## 9. Recommended Next Phase
Proceed to **Phase 1 — Permission Catalog**. We need to define central permissions (e.g., `apps/api/src/access-control/permissions.ts`) without changing any behavior yet. This will prepare the system for Phase 2 (Role-Permission mapping) and Phase 3 (AccessPolicyService).

## 10. Files Inspected
- `docs/REPO_INDEX.md`
- `docs/access-control/README.md`
- `docs/access-control/ACCESS_CONTROL_V1.md`
- `docs/access-control/IMPLEMENTATION_PLAN.md`
- `docs/access-control/AGENT_BRIEF.md`
- `prisma/schema.prisma`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/requests/request-approval-routing.service.ts`
- `apps/api/src/approvals/approvals.service.ts`
