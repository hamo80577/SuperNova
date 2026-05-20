# SuperNova Repo Index

Lightweight inspection map for future Codex and code review sessions. Prefer direct file inspection over remote code search.

## Monorepo Structure

- `apps/web`: Next.js, TypeScript, Tailwind, shadcn-style UI. Main product UI, role dashboards, request forms, profile cards, and admin pages.
- `apps/api`: NestJS modular monolith. Auth, users, assignments, workspaces, requests, approvals, reports, notifications, audit logs.
- `packages/shared`: Shared package placeholder/export surface for cross-app types or utilities.
- `prisma`: Prisma schema, migrations, seed data, and data import scripts.

## Key Product Domains

### Auth/session

- Main frontend files:
  - `apps/web/components/auth/auth-provider.tsx`
  - `apps/web/components/auth/login-form.tsx`
  - `apps/web/components/auth/protected-route.tsx`
  - `apps/web/components/auth/change-password-form.tsx`
  - `apps/web/lib/auth/api-client.ts`
  - `apps/web/lib/auth/role-redirects.ts`
  - `apps/web/lib/auth/types.ts`
- Main API files:
  - `apps/api/src/config/configuration.ts`
  - `apps/api/src/config/env.validation.ts`
  - `apps/api/src/auth/auth.controller.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/auth.module.ts`
  - `apps/api/src/auth/guards/jwt-auth.guard.ts`
  - `apps/api/src/auth/guards/roles.guard.ts`
  - `apps/api/src/auth/account-access.utils.ts`
- Important DTO/types:
  - `apps/api/src/auth/dto/login.dto.ts`
  - `apps/api/src/auth/dto/change-password.dto.ts`
  - `apps/api/src/auth/types/authenticated-user.ts`
  - `apps/api/src/auth/types/authenticated-request.ts`
- Important tests:
  - `apps/api/test/env-validation.test.ts`
  - `apps/api/test/request-logger.middleware.test.ts`

### Users/Profile

- Main frontend files:
  - `apps/web/app/users/page.tsx`
  - `apps/web/app/admin/users/page.tsx`
  - `apps/web/components/users/users-area-page.tsx`
  - `apps/web/components/users/users-area-types.ts`
  - `apps/web/components/users/users-display-utils.ts`
  - `apps/web/components/users/users-tabs.tsx`
  - `apps/web/components/users/users-toolbar.tsx`
  - `apps/web/components/users/users-actions-menu.tsx`
  - `apps/web/components/users/users-card-grid.tsx`
  - `apps/web/components/users/users-table-view.tsx`
  - `apps/web/components/users/user-avatar.tsx`
  - `apps/web/components/users/operational-user-profile-modal.tsx`
  - `apps/web/components/users/admin-profile-edit-dialog.tsx`
  - `apps/web/components/users/admin-profile-edit-validation.ts`
  - `apps/web/components/users/picker-profile-overview.tsx`
  - `apps/web/components/users/password-access-dialog.tsx`
  - `apps/web/components/users/user-request-detail-modal.tsx`
  - `apps/web/components/ui/copy-button.tsx`
  - `apps/web/components/admin/admin-users-page.tsx`
  - `apps/web/lib/api/users.ts`
- Main API files:
  - `apps/api/src/users/users.controller.ts`
  - `apps/api/src/users/users.service.ts`
  - `apps/api/src/users/users.module.ts`
  - `apps/api/src/users/temporary-password.service.ts`
- Key API endpoints:
  - `GET /api/users`: Admin/Super Admin paginated safe-user list.
  - `GET /api/users/operational-list`: Admin/Super Admin paginated Users page list with assignment-table Branch/Chain context and latest pending Transfer/Resignation summary for operational status.
  - `GET /api/users/:id/operational-profile`: Operational profile modal data, recent requests, request/user-linked activity timeline data, and credential permissions.
  - `GET /api/users/:id/area-manager-chain-assignments`: Admin/Super Admin read of active Area Manager Chain assignments.
  - `POST /api/users/:id/area-manager-chain-assignments`: Admin/Super Admin adds active `ChainAreaManagerAssignment` rows from the Area Manager profile.
  - `DELETE /api/users/:id/area-manager-chain-assignments/:assignmentId`: Admin/Super Admin closes an active Area Manager Chain assignment unless open requests still require that Chain.
- Important DTO/types:
  - `apps/api/src/users/dto/area-manager-chain-assignment.dto.ts`
  - `apps/api/src/users/dto/safe-user.dto.ts`
  - `apps/api/src/users/dto/list-users-query.dto.ts`
  - `apps/api/src/users/dto/admin-profile.dto.ts`
  - `apps/api/src/users/dto/profile-completion.dto.ts`
  - `apps/web/lib/auth/types.ts`
- Important tests:
  - `apps/web/components/users/admin-profile-edit-validation.test.ts`
  - `apps/api/test/users-list-filters.test.ts`
  - `apps/api/test/users-admin-profile.dto.test.ts`
  - `apps/api/test/users-area-manager-chain-assignments.test.ts`
- Notes:
  - Operational profiles keep identity/contact, operational context, and profile data separated. Admin/Super Admin profile edits open from the profile quick action menu in a top-layer dialog with client-side required-field validation.

### Workspaces

- Main frontend files:
  - `apps/web/components/workspaces/role-workspaces.tsx`
  - `apps/web/components/workspaces/champ-branches.tsx`
  - `apps/web/components/workspaces/champ/champ-branch-workspace.tsx`
  - `apps/web/components/workspaces/champ/champ-branch-pickers.tsx`
  - `apps/web/lib/api/workspaces.ts`
- Main API files:
  - `apps/api/src/workspaces/workspaces.controller.ts`
  - `apps/api/src/workspaces/workspaces.service.ts`
  - `apps/api/src/workspaces/workspaces.module.ts`
- Notes:
  - Champ and Area Manager workspace scoped Picker/Champ rows expose latest pending Transfer/Resignation summary so Users status can render as Active, Pending, or Resigned consistently across roles.
- Important DTO/types:
  - `apps/web/lib/api/workspaces.ts`
  - `apps/web/components/workspaces/champ/champ-branch-types.ts`
- Important tests:
  - No focused workspace test file currently identified.

### Requests

- Main frontend files:
  - `apps/web/app/requests/page.tsx`
  - `apps/web/app/requests/[id]/page.tsx`
  - `apps/web/components/requests/center/request-operations-center.tsx`
  - `apps/web/components/requests/forms/new-request-sheet.tsx`
  - `apps/web/components/requests/forms/new-request-menu.tsx`
  - `apps/web/components/requests/detail/request-detail-page-content.tsx`
  - `apps/web/components/requests/detail/request-type-panel.tsx`
  - `apps/web/lib/api/requests.ts`
- Main API files:
  - `apps/api/src/requests/requests.controller.ts`
  - `apps/api/src/requests/requests.service.ts`
  - `apps/api/src/requests/requests.module.ts`
  - `apps/api/src/requests/request-approval-routing.service.ts`
  - `apps/api/src/requests/request-status-machine.ts`
  - `apps/api/src/requests/request-response.utils.ts`
  - `apps/api/src/requests/request-includes.ts`
- Important DTO/types:
  - `apps/api/src/requests/dto/create-request.dto.ts`
  - `apps/api/src/requests/dto/list-requests-query.dto.ts`
  - `apps/api/src/requests/dto/cancel-request.dto.ts`
  - `apps/web/components/requests/shared/request-types.ts`
  - `apps/web/components/requests/shared/request-utils.ts`
- Important tests:
  - `apps/api/test/request-approval-routing.test.ts`
  - `apps/api/test/new-hire-workflow.policy.test.ts`
  - `apps/api/test/new-hire-workflow.rehire.test.ts`
  - `apps/api/test/offboarding-workflow.policy.test.ts`

### New Hire workflow

- Main frontend files:
  - `apps/web/components/requests/forms/new-hire/new-hire-form.tsx`
  - `apps/web/components/requests/forms/new-hire/new-hire-lookup.tsx`
  - `apps/web/components/requests/forms/new-hire/new-hire-request-modal.tsx`
  - `apps/web/components/requests/forms/new-hire/new-hire-branch-context.tsx`
  - `apps/web/components/requests/forms/new-hire/new-hire-utils.ts`
  - `apps/web/components/requests/actions/request-approval-decision-panel.tsx`
  - `apps/web/components/requests/actions/finalize-new-hire-panel.tsx`
  - `apps/web/components/workspaces/champ-new-hire-form.tsx`
- Main API files:
  - `apps/api/src/requests/workflows/new-hire-approval.service.ts`
  - `apps/api/src/requests/workflows/new-hire-workflow.service.ts`
  - `apps/api/src/requests/workflows/new-hire-candidate.service.ts`
  - `apps/api/src/requests/workflows/new-hire-request-creation.service.ts`
  - `apps/api/src/requests/workflows/new-hire-finalization.service.ts`
  - `apps/api/src/requests/workflows/new-hire-workflow.policy.ts`
  - `apps/api/src/requests/workflows/new-hire-payload.ts`
- Important DTO/types:
  - `apps/api/src/approvals/dto/approval-decision.dto.ts`
  - `apps/api/src/requests/dto/create-new-hire-request.dto.ts`
  - `apps/api/src/requests/dto/lookup-new-hire-candidate.dto.ts`
  - `apps/api/src/requests/dto/finalize-new-hire.dto.ts`
  - `apps/api/src/requests/workflows/new-hire-workflow.types.ts`
  - `apps/web/lib/api/requests.ts`
- Important tests:
  - `apps/api/test/new-hire-workflow.policy.test.ts`
  - `apps/api/test/new-hire-workflow.rehire.test.ts`
  - `apps/api/test/new-hire-workflow.approval.test.ts`

### Resignation workflow

- Main frontend files:
  - `apps/web/components/requests/forms/resignation/resignation-form.tsx`
  - `apps/web/components/requests/forms/resignation/offboarding-picker-search.tsx`
  - `apps/web/components/requests/forms/resignation/block-decision-fields.tsx`
  - `apps/web/components/requests/actions/finalize-offboarding-panel.tsx`
  - `apps/web/components/workspaces/champ-offboarding-form.tsx`
- Main API files:
  - `apps/api/src/requests/workflows/offboarding-workflow.service.ts`
  - `apps/api/src/requests/workflows/offboarding-types.ts`
  - `apps/api/src/requests/workflows/offboarding-payload.ts`
  - `apps/api/src/requests/workflows/offboarding-search.service.ts`
  - `apps/api/src/requests/workflows/offboarding-target.service.ts`
  - `apps/api/src/requests/workflows/offboarding-request-creation.service.ts`
  - `apps/api/src/requests/workflows/offboarding-approval.service.ts`
  - `apps/api/src/requests/workflows/offboarding-finalization.service.ts`
  - `apps/api/src/requests/workflows/offboarding-response.utils.ts`
  - `apps/api/src/requests/workflows/offboarding-workflow.policy.ts`
- Important DTO/types:
  - `apps/api/src/requests/dto/create-offboarding-request.dto.ts`
  - `apps/api/src/requests/dto/search-offboarding-pickers.dto.ts`
  - `apps/api/src/requests/dto/finalize-offboarding.dto.ts`
  - `apps/web/lib/api/requests.ts`
- Important tests:
  - `apps/api/test/offboarding-workflow.policy.test.ts`
  - `apps/api/test/offboarding-payload.test.ts`
  - `apps/api/test/offboarding-workflow.approval-finalization.test.ts`

### Transfer workflow

- Main frontend files:
  - `apps/web/components/requests/forms/transfer/transfer-form.tsx`
  - `apps/web/components/requests/forms/transfer/transfer-utils.ts`
  - `apps/web/components/workspaces/champ-transfer-form.tsx`
  - `apps/web/app/champ/branches/[vendorId]/transfer/page.tsx`
- Main API files:
  - `apps/api/src/requests/workflows/transfer-workflow.service.ts`
- Important DTO/types:
  - `apps/api/src/requests/dto/create-transfer-request.dto.ts`
  - `apps/web/components/requests/shared/request-types.ts`
  - `apps/web/lib/api/requests.ts`
- Important tests:
  - `apps/api/test/transfer-workflow.test.ts`

### Organization/Chains/Branches

- Main frontend files:
  - `apps/web/app/admin/organization/page.tsx`
  - `apps/web/components/admin/organization-control-center.tsx`
  - `apps/web/lib/api/organization.ts`
  - `apps/web/lib/api/admin-organization.ts`
- Main API files:
  - `apps/api/src/admin/admin.controller.ts`
  - `apps/api/src/admin/admin.service.ts`
  - `apps/api/src/chains/chains.controller.ts`
  - `apps/api/src/chains/chains.service.ts`
  - `apps/api/src/vendors/vendors.controller.ts`
  - `apps/api/src/vendors/vendors.service.ts`
  - `apps/api/src/assignments/assignments.controller.ts`
  - `apps/api/src/assignments/assignments.service.ts`
- Important DTO/types:
  - `apps/api/src/chains/dto/create-chain.dto.ts`
  - `apps/api/src/chains/dto/update-chain.dto.ts`
  - `apps/api/src/vendors/dto/create-vendor.dto.ts`
  - `apps/api/src/vendors/dto/update-vendor.dto.ts`
  - `apps/api/src/assignments/dto/list-assignments-query.dto.ts`
- Important tests:
  - No focused organization/assignment test file currently identified.

### Local cleanup scripts

- Main files:
  - `apps/api/scripts/clear-open-requests.ts`
- Notes:
  - `npm run cleanup:open-requests` is a local/dev dry-run by default.
  - `npm run cleanup:open-requests -- --confirm` deletes only open requests with statuses `DRAFT`, `PENDING_AREA_MANAGER`, `PENDING_DESTINATION_AREA_MANAGER`, and `PENDING_ADMIN`; completed/rejected/cancelled/approved history is not targeted.

### Notifications

- Main frontend files:
  - `apps/web/app/notifications/page.tsx`
  - `apps/web/components/notifications/notifications-center.tsx`
  - `apps/web/components/dashboard/dashboard-notifications-menu.tsx`
  - `apps/web/lib/api/notifications.ts`
  - `apps/web/lib/notifications/view-model.ts`
- Main API files:
  - `apps/api/src/notifications/notifications.controller.ts`
  - `apps/api/src/notifications/notifications.service.ts`
  - `apps/api/src/notifications/notifications.module.ts`
- Important DTO/types:
  - `apps/api/src/notifications/dto/list-notifications-query.dto.ts`
- Important tests:
  - No focused notifications test file currently identified.

### Audit logs

- Main frontend files:
  - `apps/web/app/admin/audit-logs/page.tsx`
  - `apps/web/components/admin/organization-control-center.tsx`
- Main API files:
  - `apps/api/src/audit/audit.controller.ts`
  - `apps/api/src/audit/audit.service.ts`
  - `apps/api/src/audit/audit.module.ts`
- Important DTO/types:
  - Prisma `AuditLog` model in `prisma/schema.prisma`
- Important tests:
  - No focused audit log test file currently identified.

## Current Lifecycle Workflow Map

- New Hire Picker:
  - UI: role selection, Branch context, candidate lookup, profile fields for new users. Area Manager-created Picker requests capture Shopper ID at submit; Champ/Admin-created Picker requests capture Shopper ID during Area Manager approval.
  - API: `NewHireWorkflowService` creates request, `NewHireApprovalService` records the Area Manager Shopper ID decision, and `NewHireFinalizationService` creates user and `PickerBranchAssignment` only after Admin final approval.
  - Finalization resolves Shopper ID from the Area Manager decision or a valid existing Rehire Shopper ID. Admin final approval does not accept an editable Shopper ID.
- New Hire Champ:
  - UI: role selection, Branch context, candidate lookup, profile fields for new users.
  - API: request creation and finalization create Champ user and `VendorChampAssignment`.
  - No Shopper ID required.
- New Hire Area Manager:
  - UI: role selection and candidate identity only. Chain assignment is managed from Users List -> Area Manager Profile after creation.
  - API: request creation and finalization create the Area Manager user only. `ChainAreaManagerAssignment` rows are not created by New Hire finalization.
  - Rehire is not supported.
- Area Manager Chain assignment:
  - UI: Admin/Super Admin manages active Chains from the Area Manager operational profile. Organization Control Center displays current Area Manager read-only and no longer assigns Area Managers.
  - API: Users endpoints add/close `ChainAreaManagerAssignment`; Organization Control Center replacement endpoint returns a Bad Request directing users to the profile path.
- Rehire Picker:
  - UI: previous profile card is read-only; notes remain available.
  - API: old user profile is source of truth; active duplicate, active temporary block, permanent block, active assignment, and pending duplicate checks run before request creation.
  - Finalization reactivates existing user, creates a new `PickerBranchAssignment`, reuses old Shopper ID by default, generates temporary password, and clears expired temporary block state.
- Rehire Champ:
  - UI: previous profile card is read-only; notes remain available.
  - API: old user profile is source of truth; active duplicate, active temporary block, permanent block, active assignment, and pending duplicate checks run before request creation.
  - Finalization reactivates existing user, creates a new `VendorChampAssignment`, generates temporary password, and clears expired temporary block state.
- Resignation Picker:
  - UI: role-based Resignation form with scoped eligible Pickers. Area Manager block decision supports only No block or Permanent block.
  - API: `OffboardingWorkflowService` creates and finalizes resignation, requires Area Manager block decision before Admin confirmation, closes active `PickerBranchAssignment`, archives/deactivates user through workflow, and never creates new temporary Resignation blocks.
- Resignation Champ:
  - UI: role-based Resignation form with scoped eligible Champs. Area Manager block decision supports only No block or Permanent block.
  - API: requires Area Manager block decision before Admin confirmation, closes active `VendorChampAssignment`, archives/deactivates user through workflow, and never creates new temporary Resignation blocks.
- Resignation Area Manager:
  - UI: Admin/Super Admin role option only.
  - API: Admin-only confirmation force-applies No block, closes active `ChainAreaManagerAssignment` records, and archives/deactivates user through workflow.
- Transfer Picker only:
  - UI: Transfer action is Picker-only and should pass selected Picker/current Branch context when available.
  - API: `TransferWorkflowService` enforces active Picker target, source Branch, destination Branch, approval path, and pending duplicate checks.
  - Transfer is not valid for Champ, Area Manager, Admin, or Super Admin.

## Commands

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck -- --pretty false
npm run lint
npm run build
npm run prisma:migrate
npm run db:seed
npm run cleanup:open-requests
npm run cleanup:open-requests -- --confirm
npx tsx apps/api/test/new-hire-workflow.policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts
npx tsx apps/api/test/offboarding-workflow.policy.test.ts
npx tsx apps/api/test/offboarding-payload.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts
npx tsx apps/api/test/env-validation.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-list-filters.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-admin-profile.dto.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-area-manager-chain-assignments.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts
```

## Known Review Notes

- GitHub code search may not be indexed/reliable.
- Prefer direct file inspection with `rg`, `rg --files`, and targeted file reads.
- Keep `docs/REPO_INDEX.md` updated whenever moving major files or adding workflow modules.
