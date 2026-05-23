# Phase 7I Custom Role Assignment API Design

## 1. Executive Summary

Phase 7I designs future custom-role management APIs, user assignment APIs, audit rules, and permission-cache refresh behavior for the DB-backed Access Control V1 foundation.

This phase is design-only:

- no implementation
- no endpoints
- no UI
- no Prisma schema changes
- no migrations
- no runtime behavior changes

The design preserves SuperNova's product model: role-based workspaces, assignment-table operational scope, and workflow-based lifecycle changes.

## 2. Current Foundation

The current backend foundation already includes:

- `AccessRole`
  - Stores SYSTEM and CUSTOM access-role definitions.
  - SYSTEM rows mirror current `UserRole` values.
  - CUSTOM rows are future custom permission bundles.
- `AccessRolePermission`
  - Stores permission keys assigned to an `AccessRole`.
  - `permissionKey` remains a string validated against the code-owned catalog.
- `UserAccessRoleAssignment`
  - Stores future user-to-access-role assignments.
  - It is not a workspace/persona field.
- Active-only partial unique index on `UserAccessRoleAssignment`
  - Allows one ACTIVE assignment per user/access-role pair.
  - Allows multiple INACTIVE historical rows.
- SYSTEM role permission seed/sync
  - `SYSTEM_ROLE_PERMISSIONS` remains the code source of truth.
  - `prisma/access-role-seed.ts` mirrors those rows into the database.
- `AccessPolicyService`
  - Loads DB-backed SYSTEM permission cache at startup with code-matrix fallback.
  - Reads ACTIVE CUSTOM `UserAccessRoleAssignment` rows as additive user-specific grants.
  - Rejects CUSTOM grants containing unknown, non-assignable, or system-only permissions.
  - Keeps `hasPermission`, `can`, and `assertCan` synchronous.

`User.role` remains the primary persona/workspace field. Operational scope remains assignment-table based through:

- `PickerBranchAssignment`
- `VendorChampAssignment`
- `ChainAreaManagerAssignment`

## 3. Core Product Rules

- Custom roles are additive only.
- Custom roles must not remove base `User.role` permissions.
- Custom roles must not change login redirect, workspace, or persona.
- Custom roles must not create operational scope.
- Custom roles must not promote Picker to Champ.
- Custom roles must not bypass lifecycle workflows.
- SYSTEM roles are seed/system-managed.
- First implementation should only assign CUSTOM `AccessRole` rows to users.
- Picker to Champ remains a separate Role Transition/Admin-controlled workflow.

Sensitive lifecycle changes must still follow:

```text
Request -> Approval -> System applies change
```

## 4. Future API Design

All endpoints in this section are future design only. They should use `JwtAuthGuard`, `RolesGuard`, and a Super Admin perimeter such as `@Roles(UserRole.SUPER_ADMIN)` in the first implementation, plus `AccessPolicyService.assertCan(...)` with the relevant permission.

### A. Custom Role Management

#### GET /api/access-control/roles

Purpose:

- List access roles for Super Admin review.
- First implementation should include CUSTOM roles and may include read-only SYSTEM role mirrors.

Required permission:

- `ACCESS_CONTROL_VIEW_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

- None.

Suggested query:

```ts
{
  kind?: "SYSTEM" | "CUSTOM";
  status?: "ACTIVE" | "INACTIVE";
  search?: string;
  page?: number;
  pageSize?: number;
}
```

Response shape:

```ts
{
  items: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    kind: "SYSTEM" | "CUSTOM";
    status: "ACTIVE" | "INACTIVE";
    isSystem: boolean;
    systemRole: string | null;
    permissionCount: number;
    activeAssignmentCount?: number;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

Validation rules:

- `page` and `pageSize` must be bounded.
- `kind` and `status` must be valid enum values.
- Read-only SYSTEM rows must be clearly labeled as code-owned mirrors.

Audit event:

- No persistent audit event by default for list reads.
- If product requires read auditing, add a separate `ACCESS_ROLE_LIST_VIEWED` action before implementation.

Notes/risks:

- Do not make SYSTEM rows editable from this endpoint.
- Do not imply DB SYSTEM rows are the source of truth while seed remains code-owned.

#### POST /api/access-control/roles

Purpose:

- Create a CUSTOM access role.

Required permission:

- `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  key: string;
  name: string;
  description?: string | null;
  permissionKeys?: string[];
  reason?: string;
}
```

Response shape:

```ts
{
  role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    kind: "CUSTOM";
    status: "ACTIVE";
    isSystem: false;
    systemRole: null;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
  };
}
```

Validation rules:

- `key` must be unique and stable.
- `key` must not start with reserved prefixes such as `system.`.
- `kind` must be `CUSTOM`.
- `isSystem` must be `false`.
- `systemRole` must be `null`.
- `name` is required.
- Every permission key must exist in the catalog.
- Every permission must have `assignable === true`.
- No permission may have `systemOnly === true`.
- High-risk permissions require explicit Super Admin intent in `reason`.

Audit event:

- `ACCESS_ROLE_CREATED`

Notes/risks:

- This endpoint must not create assignments.
- Creating a role must not grant any user permissions until an assignment is added.

#### GET /api/access-control/roles/:id

Purpose:

- Read one access role with permission metadata and assignment summary.

Required permission:

- `ACCESS_CONTROL_VIEW_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

- None.

Response shape:

```ts
{
  role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    kind: "SYSTEM" | "CUSTOM";
    status: "ACTIVE" | "INACTIVE";
    isSystem: boolean;
    systemRole: string | null;
    permissions: Array<{
      key: string;
      label: string;
      group: string;
      riskLevel: string;
      assignable: boolean;
      systemOnly: boolean;
    }>;
    activeAssignmentCount: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

Validation rules:

- Role id must exist.
- SYSTEM roles must be returned as read-only code-owned mirrors.

Audit event:

- No persistent audit event by default for role detail reads.
- If product requires read auditing, add a separate `ACCESS_ROLE_VIEWED` action before implementation.

Notes/risks:

- Do not expose user assignment lists in this response unless explicitly scoped and authorized.

#### PATCH /api/access-control/roles/:id

Purpose:

- Update CUSTOM role metadata.

Required permission:

- `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  name?: string;
  description?: string | null;
  reason?: string;
}
```

Response shape:

```ts
{
  role: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    kind: "CUSTOM";
    status: "ACTIVE" | "INACTIVE";
    updatedAt: string;
  };
}
```

Validation rules:

- Target role must exist.
- Target role must be CUSTOM.
- SYSTEM roles cannot be patched.
- `key`, `kind`, `isSystem`, and `systemRole` are not mutable.
- At least one safe metadata field must be submitted.

Audit event:

- `ACCESS_ROLE_UPDATED`

Notes/risks:

- Permission changes should use the explicit permission sync endpoint, not this metadata endpoint.

#### POST /api/access-control/roles/:id/deactivate

Purpose:

- Deactivate a CUSTOM access role without deleting history.

Required permission:

- `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  reason: string;
  revokeActiveAssignments?: boolean;
}
```

Response shape:

```ts
{
  role: {
    id: string;
    status: "INACTIVE";
    updatedAt: string;
  };
  revokedAssignmentCount?: number;
}
```

Validation rules:

- Target role must exist.
- Target role must be CUSTOM.
- SYSTEM roles cannot be deactivated through this endpoint.
- `reason` is required.
- First implementation should choose one clear assignment behavior:
  - keep existing active assignments but make them ineffective because the role is inactive, or
  - revoke active assignments in the same transaction when `revokeActiveAssignments === true`.

Audit event:

- `ACCESS_ROLE_DEACTIVATED`

Notes/risks:

- If active assignments are not revoked, the effective permission service must clearly show inactive-role assignments as ineffective.
- Cache refresh must happen after the transaction.

#### POST /api/access-control/roles/:id/permissions/sync

Purpose:

- Replace a CUSTOM role's permission set with a validated desired set.

Required permission:

- `ACCESS_CONTROL_MANAGE_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  permissionKeys: string[];
  reason: string;
}
```

Response shape:

```ts
{
  role: {
    id: string;
    key: string;
    permissions: string[];
    updatedAt: string;
  };
  addedPermissionKeys: string[];
  removedPermissionKeys: string[];
}
```

Validation rules:

- Target role must exist.
- Target role must be CUSTOM.
- SYSTEM role permissions cannot be changed through this endpoint.
- Permission keys must be unique.
- Every permission key must exist in the catalog.
- Every permission must have `assignable === true`.
- No permission may have `systemOnly === true`.
- High-risk permissions require explicit Super Admin-level confirmation in `reason`.
- Empty permission set is allowed only if product approves role shells.

Audit event:

- `ACCESS_ROLE_PERMISSIONS_SYNCED`

Notes/risks:

- Must include before/after permission lists in audit.
- Must refresh permission caches after transaction.

### B. User Access Role Assignment

#### GET /api/users/:id/access-role-assignments

Purpose:

- Read CUSTOM access-role assignments for one user.

Required permission:

- `ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

- None.

Response shape:

```ts
{
  user: {
    id: string;
    role: string;
    nameEn: string;
    accountStatus: string;
    employmentStatus: string;
  };
  assignments: Array<{
    id: string;
    status: "ACTIVE" | "INACTIVE";
    startsAt: string;
    endsAt: string | null;
    accessRole: {
      id: string;
      key: string;
      name: string;
      status: "ACTIVE" | "INACTIVE";
      kind: "CUSTOM";
    };
    effectiveNow: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

Validation rules:

- Target user must exist.
- Response must not imply assignments change `User.role`.
- SYSTEM access-role assignments should be omitted or shown as ignored only if legacy rows exist.

Audit event:

- No persistent audit event by default for assignment list reads.
- Use `USER_EFFECTIVE_PERMISSIONS_VIEWED` for the effective-permissions endpoint instead.

Notes/risks:

- This is a management view, not operational scope.
- It must not expose raw credentials or unrelated profile data.

#### POST /api/users/:id/access-role-assignments

Purpose:

- Assign an ACTIVE CUSTOM access role to a user.

Required permission:

- `ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  accessRoleId: string;
  startsAt?: string;
  endsAt?: string | null;
  reason: string;
}
```

Response shape:

```ts
{
  assignment: {
    id: string;
    userId: string;
    accessRoleId: string;
    status: "ACTIVE";
    startsAt: string;
    endsAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  cacheRefresh: {
    refreshed: boolean;
    warning?: string;
  };
}
```

Validation rules:

- Target user must exist.
- Target user should be active.
- `AccessRole` must exist.
- `AccessRole.kind` must be `CUSTOM`.
- `AccessRole.status` must be `ACTIVE`.
- `AccessRole.isSystem` must be `false`.
- SYSTEM roles cannot be assigned in the first implementation.
- `startsAt` defaults to now.
- `endsAt` must be null or future.
- Duplicate ACTIVE assignment is blocked by the DB partial unique index.
- Assignment does not change `User.role`.
- Assignment does not create operational scope.
- Assignment must be audited.

Audit event:

- `USER_ACCESS_ROLE_ASSIGNED`

Notes/risks:

- Must run in a transaction.
- Must refresh permission caches after commit.
- Must not be used for Picker to Champ promotion.

#### POST /api/users/:id/access-role-assignments/:assignmentId/revoke

Purpose:

- Revoke a user's active CUSTOM access-role assignment.

Required permission:

- `ACCESS_CONTROL_REVOKE_CUSTOM_ROLES`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

```ts
{
  reason: string;
  endsAt?: string;
}
```

Response shape:

```ts
{
  assignment: {
    id: string;
    userId: string;
    accessRoleId: string;
    status: "INACTIVE";
    startsAt: string;
    endsAt: string;
    updatedAt: string;
  };
  cacheRefresh: {
    refreshed: boolean;
    warning?: string;
  };
}
```

Validation rules:

- Target user must exist.
- Assignment must exist for the target user.
- Assignment must be ACTIVE.
- Assignment must reference a CUSTOM access role.
- No hard delete.
- Revoke sets `status = INACTIVE` and `endsAt`.
- `reason` is required.
- Revoke must be audited.

Audit event:

- `USER_ACCESS_ROLE_REVOKED`

Notes/risks:

- Stale cache after revoke is a privilege-retention risk.
- First implementation should fail the mutation if cache refresh fails unless a restart-required mode is explicitly approved.

### C. Effective Permissions Read-only

#### GET /api/access-control/effective-permissions/users/:id

Purpose:

- Explain a user's current effective permissions.
- Show base role permissions, additive CUSTOM grants, and final merged permissions.

Required permission:

- `ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS`

Allowed actor roles:

- `SUPER_ADMIN`

Request body:

- None.

Response shape:

```ts
{
  user: {
    id: string;
    role: string;
    nameEn: string;
    accountStatus: string;
    employmentStatus: string;
  };
  base: {
    source: "USER_ROLE";
    role: string;
    permissionKeys: string[];
  };
  customAssignments: Array<{
    assignmentId: string;
    accessRoleId: string;
    accessRoleKey: string;
    accessRoleName: string;
    startsAt: string;
    endsAt: string | null;
    permissionKeys: string[];
  }>;
  effectivePermissions: Array<{
    key: string;
    sources: Array<
      | { type: "USER_ROLE"; role: string }
      | { type: "CUSTOM_ACCESS_ROLE"; accessRoleId: string; assignmentId: string }
    >;
  }>;
  warnings: string[];
}
```

Warnings should include:

- cache is startup-loaded only
- DB SYSTEM rows are code-owned mirrors
- SYSTEM user assignments are ignored
- inactive, expired, and future assignments are ineffective
- operational scope still comes from assignment tables

Validation rules:

- Target user must exist.
- Response must not expose unrelated private data.
- Response must distinguish permission from operational scope.

Audit event:

- `USER_EFFECTIVE_PERMISSIONS_VIEWED`

Notes/risks:

- This endpoint can expose sensitive authority information and should remain Super Admin-only in the first implementation.

## 5. Permission Keys Needed

Recommended future permission keys:

```ts
ACCESS_CONTROL_VIEW_CUSTOM_ROLES = "access_control.custom_roles.view"
ACCESS_CONTROL_MANAGE_CUSTOM_ROLES = "access_control.custom_roles.manage"
ACCESS_CONTROL_ASSIGN_CUSTOM_ROLES = "access_control.custom_roles.assign"
ACCESS_CONTROL_REVOKE_CUSTOM_ROLES = "access_control.custom_roles.revoke"
ACCESS_CONTROL_VIEW_EFFECTIVE_PERMISSIONS = "access_control.effective_permissions.view"
ACCESS_CONTROL_VIEW_ACCESS_AUDIT = "access_control.audit.view"
```

Rules:

- Add these keys in a later phase only.
- Default owner should be `SUPER_ADMIN`.
- `ADMIN` should not automatically get custom-role management permissions.
- Assignment permission may be split later by scope if needed.
- These permissions should start as `systemOnly: true` and `assignable: false` unless the product owner explicitly approves delegation.

## 6. Guardrails for Custom Role Permissions

### A. Safe assignable permissions

Examples:

- self-service permissions
- notification own-read/manage permissions
- read/list permissions that still rely on existing service scope checks
- low-risk operational visibility permissions

Rules:

- These may be assignable to CUSTOM roles when `assignable === true` and `systemOnly === false`.
- They still do not create assignment-table scope.

### B. Admin-only assignable permissions

Examples:

- operational admin report visibility
- operational profile visibility
- organization read/manage permissions that still rely on service validation

Rules:

- These should require explicit Super Admin confirmation.
- They should not be granted broadly to operational users without product review.
- Existing service-level target and scope checks must remain authoritative.

### C. Blocked/system-only permissions

Examples:

- access-control management
- system settings/security
- permissions marked `systemOnly`
- permissions marked `assignable: false`

Rules:

- CUSTOM roles must not grant these permissions.
- Normal Admin must not receive access-control management permissions through CUSTOM grants.
- SYSTEM role management remains seed/system-managed until an explicit future decision.

### D. Workflow-sensitive permissions

Examples:

- `APPROVALS_DECIDE_FINAL_LIFECYCLE`
- `APPROVALS_DECIDE_CHAIN`
- temporary password read/manage permissions
- user assignment management permissions
- lifecycle request creation permissions

Rules:

- Custom roles must not grant workflow bypass.
- Final lifecycle approval permissions should be blocked unless Super Admin explicitly allows them in a future high-risk exception process.
- Temporary password permissions should require explicit review and audit.
- Assignment does not create Chain, Branch, Picker, Champ, or Area Manager scope.
- A permission grant only opens the permission gate; workflow services must still enforce state, ownership, scope, audit, and notifications.

## 7. Assignment Validation Rules

For assigning a custom access role to a user:

- target user must exist
- target user should be active
- `AccessRole` must be CUSTOM
- `AccessRole` must be ACTIVE
- SYSTEM roles cannot be assigned in the first implementation
- `startsAt` defaults to now
- `endsAt` must be null or future
- duplicate ACTIVE assignment is blocked by the DB partial unique index
- revoke sets status INACTIVE and sets `endsAt`
- no hard delete
- `User.role` is not changed
- assignment does not create operational scope
- assignment must be audited
- cache refresh must run after successful assignment or revoke

## 8. Custom Role Validation Rules

For creating or updating custom roles:

- `key` must be unique and stable
- `key` must not use reserved system prefixes such as `system.*`
- `kind` must be CUSTOM
- `status` starts ACTIVE unless otherwise specified
- `isSystem` must be false
- `systemRole` must be null
- `name` is required
- permissions must all exist in the catalog
- permissions must be `assignable === true`
- permissions must not be `systemOnly`
- high-risk permissions require explicit Super Admin-level decision
- deactivation should not delete role history
- deactivation should prevent new assignments
- existing active assignments behavior must be defined before implementation:
  - recommended default: inactive roles are ineffective immediately after cache refresh, while assignment rows remain for history
  - optional behavior: deactivation can revoke active assignments in the same transaction when explicitly requested

## 9. Audit Rules

Role assignment, revoke, role mutation, and permission sync must never happen without audit.

Audit actions:

### ACCESS_ROLE_CREATED

- `actorUserId`: Super Admin actor
- `entityType`: `AccessRole`
- `entityId`: created role id
- `targetUserId`: not applicable
- `oldValue`: null
- `newValue`: key, name, description, status, permission keys
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: creation reason
- `createdAt`: audit timestamp

### ACCESS_ROLE_UPDATED

- `actorUserId`: Super Admin actor
- `entityType`: `AccessRole`
- `entityId`: role id
- `targetUserId`: not applicable
- `oldValue`: previous mutable fields
- `newValue`: updated mutable fields
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: update reason if provided
- `createdAt`: audit timestamp

### ACCESS_ROLE_DEACTIVATED

- `actorUserId`: Super Admin actor
- `entityType`: `AccessRole`
- `entityId`: role id
- `targetUserId`: not applicable
- `oldValue`: previous status and active assignment count
- `newValue`: status INACTIVE and revoke behavior
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: required deactivation reason
- `createdAt`: audit timestamp

### ACCESS_ROLE_PERMISSIONS_SYNCED

- `actorUserId`: Super Admin actor
- `entityType`: `AccessRole`
- `entityId`: role id
- `targetUserId`: not applicable
- `oldValue`: previous permission key list
- `newValue`: new permission key list, added keys, removed keys
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: required sync reason
- `createdAt`: audit timestamp

### USER_ACCESS_ROLE_ASSIGNED

- `actorUserId`: Super Admin actor
- `entityType`: `UserAccessRoleAssignment`
- `entityId`: assignment id
- `targetUserId`: assigned user id inside `newValue`
- `oldValue`: null
- `newValue`: user id, accessRoleId, accessRole key, startsAt, endsAt, status
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: required assignment reason
- `createdAt`: audit timestamp

### USER_ACCESS_ROLE_REVOKED

- `actorUserId`: Super Admin actor
- `entityType`: `UserAccessRoleAssignment`
- `entityId`: assignment id
- `targetUserId`: assigned user id inside `newValue`
- `oldValue`: previous status, startsAt, endsAt, accessRoleId
- `newValue`: status INACTIVE and final endsAt
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: required revoke reason
- `createdAt`: audit timestamp

### USER_EFFECTIVE_PERMISSIONS_VIEWED

- `actorUserId`: Super Admin actor
- `entityType`: `User`
- `entityId`: inspected user id
- `targetUserId`: inspected user id inside `newValue`
- `oldValue`: null
- `newValue`: inspected role, active custom assignment ids, warning flags
- `ipAddress`: request IP
- `userAgent`: request user agent
- `reason/note`: optional view reason
- `createdAt`: audit timestamp

High-risk permission changes should be easy to review later. Permission sync audit rows must include before/after permission lists.

## 10. Cache Refresh Strategy

Current state:

- `AccessPolicyService` cache loads at startup.
- `hasPermission`, `can`, and `assertCan` must remain synchronous.

Options:

### A. Restart-required after every role/assignment change

Pros:

- simplest implementation
- no extra service methods

Cons:

- revoke remains stale until restart
- operationally unsafe once UI/API exists
- easy to forget during incident response

### B. `AccessPolicyService.refreshPermissionCaches()` after mutation

Pros:

- keeps public permission checks synchronous
- lets mutation services refresh cache after successful transaction
- explicit and testable

Cons:

- service needs refresh concurrency handling
- failed refresh behavior must be defined

### C. Version/timestamp invalidation

Pros:

- scalable path for multiple API processes
- can detect stale caches

Cons:

- requires additional metadata, polling, or eventing
- more complexity than the current monolith needs immediately

### D. DB read-through on every permission check

Pros:

- always current

Cons:

- would make checks async or block on DB
- conflicts with synchronous public API
- spreads DB latency across every guarded action

Recommendation:

- First API implementation should add `AccessPolicyService.refreshPermissionCaches()`.
- Mutation services should call `refreshPermissionCaches()` after successful transaction commit.
- If refresh fails after a role/permission/assignment mutation, the first implementation should fail the mutation or roll back if still inside a transaction.
- If rollback is not possible because the transaction already committed, return a warning and require immediate restart, but only as an explicit degraded mode.
- Do not make `hasPermission`, `can`, or `assertCan` async.
- Future scalable option: versioned invalidation for multi-process deployments.

## 11. Security and Abuse Risks

- Privilege escalation through overbroad CUSTOM roles.
- Over-permissioned custom roles granting lifecycle or credential powers.
- Stale cache after revoke leaving access active until restart or refresh.
- SYSTEM role assignment abuse if SYSTEM roles become assignable.
- Role/persona confusion where access-role assignment is mistaken for `User.role`.
- Operational scope bypass if assignments are treated as Chain or Branch authority.
- Workflow bypass if permissions are treated as direct lifecycle authority.
- Missing audit on role mutation or user assignment.
- Manual DB changes affecting authorization after restart.
- Giving access-control permissions to non-Super Admin users.
- Final lifecycle permission abuse.
- Temporary password permission abuse.

Mitigation baseline:

- Super Admin-only first implementation.
- CUSTOM-only user assignments.
- Strict permission metadata enforcement.
- Mandatory audit for every mutation.
- Cache refresh after mutation.
- Effective-permissions read-only endpoint before UI mutation surfaces.

## 12. Recommended Implementation Phases After 7I

- 7J: Add custom-role management permission keys only.
- 7K: Add `AccessPolicyService.refreshPermissionCaches()` only.
- 7L: Implement custom role read/create/update/deactivate service/controller.
- 7M: Implement custom role permission sync with guardrails.
- 7N: Implement user assignment/revoke API with audit.
- 7O: Implement effective permissions read-only endpoint.
- 7P: Add integration/e2e tests and stabilization.
- UI later, page-by-page.

## 13. Explicit Non-goals

- no UI in Phase 7I
- no endpoint implementation
- no Picker to Champ promotion
- no `User.role` replacement
- no assignment-table replacement
- no workflow bypass
- no Tenant/Country model
- no generic SaaS role builder yet
- no direct manual Picker lifecycle changes
- no payroll, attendance, GPS, inventory, orders, accounting, or generic ERP module

## 14. Acceptance Criteria

- design document created
- no production code changes
- no schema changes
- no migrations
- no UI changes
- API design is clear enough for later phases
- audit rules are defined
- cache refresh strategy is defined
- risks are documented
- next implementation phases are clearly scoped
