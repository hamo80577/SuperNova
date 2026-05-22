# Phase 7A Schema Design: DB-Backed Access Roles

## 1. Executive Summary

Phase 7 introduces a database-backed access-role foundation for Access Control V1 while preserving the current system-role model and workflow behavior.

This design does not replace `User.role`, `UserRole`, `@Roles`, `RolesGuard`, approval routing, assignment-scope logic, or lifecycle workflow services. The first database-backed role tables should mirror the current code-owned permission catalog and system role matrix, then allow controlled future expansion toward custom roles.

Phase 7A is design-only. It does not modify Prisma schema, create migrations, seed data, wire runtime authorization to the database, or add role-management UI.

Recommended Phase 7 direction:

- Keep the permission catalog code-owned initially.
- Add DB rows for current system roles before introducing user-assigned custom roles.
- Preserve code-matrix fallback while transitioning `AccessPolicyService` to DB reads in a later phase.
- Keep workflow safety in existing request, approval, user, assignment, and finalization services.

## 2. Current State

The current Access Control foundation is code-backed and intentionally conservative:

- `apps/api/src/access-control/permissions.ts` defines the code-owned permission catalog.
- `apps/api/src/access-control/role-permission.matrix.ts` maps current Prisma `UserRole` values to `PermissionKey` values.
- `AccessPolicyService` answers permission checks from the code matrix and has no database dependency.
- `User.role` still controls workspace/persona behavior and perimeter guards through `@Roles` and `RolesGuard`.
- Assignment tables remain the operational scope source of truth:
  - `PickerBranchAssignment`
  - `VendorChampAssignment`
  - `ChainAreaManagerAssignment`
- Workflow services still control lifecycle behavior, request validation, approval routing, finalization, audit, notifications, and assignment/user lifecycle mutations.
- `ApprovalStep` and `RequestApproval.approverRole` remain part of the existing workflow model.

This means Phase 7 database role tables must initially be additive. They should not become a workflow bypass or a replacement for operational scope rules.

## 3. Proposed Tables

### A. AccessRole

Recommended fields:

- `id`
- `key`
- `name`
- `description`
- `kind` or `type`: `SYSTEM` / `CUSTOM`
- `systemRole`: nullable `UserRole`
- `status`: `ACTIVE` / `INACTIVE`
- `isSystem`
- `createdAt`
- `updatedAt`

Design notes:

- `SYSTEM` rows represent current `UserRole` values: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, and `SUPER_ADMIN`.
- `CUSTOM` rows represent future custom roles.
- `key` must be unique and stable. Suggested system keys: `system.picker`, `system.champ`, `system.area_manager`, `system.admin`, `system.super_admin`.
- `systemRole` should be unique when not null, so one system role maps to at most one `AccessRole` row.
- `isSystem` should be treated as a guard/invariant for system rows. Recommended invariant: `isSystem = true` when `kind = SYSTEM`, and `isSystem = false` when `kind = CUSTOM`.
- System rows should be locked from product-admin mutation unless the product owner explicitly allows controlled Super Admin edits in a later phase.

### B. AccessRolePermission

Recommended fields:

- `id`
- `accessRoleId`
- `permissionKey`
- `createdAt`
- `updatedAt`

Design notes:

- `permissionKey` remains a string and must match a key from the code-owned `PermissionKey` catalog.
- Add a unique pair on `accessRoleId + permissionKey`.
- Do not add a separate `Permission` table in Phase 7 unless there is a strong product reason. The permission catalog should remain code-owned initially to avoid migration churn for every permission metadata edit.
- Seed and runtime validation should reject permission strings that do not exist in the catalog.

### C. UserAccessRoleAssignment

Recommended status: optional/future, likely Phase 7D.

Recommended fields:

- `id`
- `userId`
- `accessRoleId`
- `status`: `ACTIVE` / `INACTIVE`
- `startsAt`
- `endsAt`
- `createdAt`
- `updatedAt`

Design notes:

- This table must not replace `User.role` immediately.
- It may allow future extra custom permissions for users after system roles are safely DB-backed.
- `User.role` remains the primary workspace/persona field.
- Assignment-scope tables remain the source of operational scope.
- Access role assignments should never grant direct lifecycle powers that bypass request and approval workflows.

## 4. Prisma Schema Proposal

Do not edit `prisma/schema.prisma` in Phase 7A. The following is a draft for future migration design only.

```prisma
enum AccessRoleKind {
  SYSTEM
  CUSTOM
}

enum AccessRoleStatus {
  ACTIVE
  INACTIVE
}

enum AccessRoleAssignmentStatus {
  ACTIVE
  INACTIVE
}
```

```prisma
model User {
  // Existing fields remain unchanged, including:
  // id
  // role UserRole

  accessRoleAssignments UserAccessRoleAssignment[] @relation("UserAccessRoleAssignments")
}

model AccessRole {
  id          String           @id @default(uuid())
  key         String           @unique
  name        String
  description String?
  kind        AccessRoleKind
  systemRole  UserRole?        @unique
  status      AccessRoleStatus @default(ACTIVE)
  isSystem    Boolean          @default(false)

  permissions     AccessRolePermission[]    @relation("AccessRolePermissions")
  userAssignments UserAccessRoleAssignment[] @relation("AccessRoleAssignments")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([kind, status])
  @@index([status])
}

model AccessRolePermission {
  id           String @id @default(uuid())
  accessRoleId String
  permissionKey String

  accessRole AccessRole @relation("AccessRolePermissions", fields: [accessRoleId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([accessRoleId, permissionKey])
  @@index([permissionKey])
}

model UserAccessRoleAssignment {
  id           String                     @id @default(uuid())
  userId       String
  accessRoleId String
  status       AccessRoleAssignmentStatus @default(ACTIVE)
  startsAt     DateTime                   @default(now())
  endsAt       DateTime?

  user       User       @relation("UserAccessRoleAssignments", fields: [userId], references: [id], onDelete: Cascade)
  accessRole AccessRole @relation("AccessRoleAssignments", fields: [accessRoleId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
  @@index([accessRoleId, status])
  @@index([userId, accessRoleId, status])
}
```

Notes:

- PostgreSQL allows multiple null values in a unique nullable column, so `systemRole UserRole? @unique` supports one row per non-null system role while allowing many custom roles with `systemRole = null`.
- If a stricter invariant is required, a future migration can add a database check constraint for `kind`, `isSystem`, and `systemRole` consistency.
- `UserAccessRoleAssignment` is shown for design completeness but should not be included in Phase 7B unless explicitly approved.

## 5. Migration Strategy

Recommended small migrations:

- Phase 7B: Add `AccessRole` and `AccessRolePermission` only.
  - Include `AccessRoleKind` and `AccessRoleStatus`.
  - Do not add `UserAccessRoleAssignment`.
  - Do not wire runtime authorization to DB tables.
- Phase 7C: Add a seed script to populate `SYSTEM` roles from `SYSTEM_ROLE_PERMISSIONS`.
  - Validate permissions against the code catalog.
  - Keep the operation idempotent.
- Phase 7D: Add `UserAccessRoleAssignment` only if the product owner confirms that custom roles should be assignable to users in Phase 7.
- Phase 7E: Prepare `AccessPolicyService` DB read path with fallback to the code matrix.
  - Read database permissions where available.
  - Fall back to `SYSTEM_ROLE_PERMISSIONS` during transition.
  - Keep `User.role` as the system role/persona input.

This sequencing reduces blast radius by separating schema creation, data seeding, user assignment semantics, and runtime authorization changes.

## 6. Seed Strategy

Seed system access roles from `SYSTEM_ROLE_PERMISSIONS`:

- `PICKER`
- `CHAMP`
- `AREA_MANAGER`
- `ADMIN`
- `SUPER_ADMIN`

Recommended seed rules:

- Use stable system keys, for example:
  - `system.picker`
  - `system.champ`
  - `system.area_manager`
  - `system.admin`
  - `system.super_admin`
- Upsert by `key`.
- Set `kind = SYSTEM`, `isSystem = true`, `status = ACTIVE`, and `systemRole` to the matching `UserRole`.
- Validate every permission key against the code-owned permission catalog before writing.
- Update system-role permission rows when the matrix changes.
- Do not delete access role rows automatically.
- Do not delete custom roles automatically.
- Do not create permissions that are absent from the catalog.
- Prefer transactionally syncing each system role's permission set to the matrix so partial seed failures do not leave mixed state.

The seed should preserve system role identity while allowing permission mappings to be refreshed from code.

## 7. Runtime Strategy

Future `AccessPolicyService` behavior should remain additive and conservative:

- Phase 7E may read DB-backed system role permissions.
- During transition, fallback to the code matrix should remain available.
- Scope and state validation must remain in existing services:
  - request visibility and lifecycle rules in `RequestsService` and workflow services
  - approval ownership/current-step/status rules in `ApprovalsService`
  - user credential/profile/assignment safety rules in `UsersService`
  - report and notification service behavior in their current services
- DB permissions must not bypass workflows.
- `User.role` should remain the primary workspace/persona and perimeter guard field.
- Custom role permissions, when introduced, should only grant permission checks that still flow through existing service-level validation.

## 8. Admin vs Super Admin

Admin and Super Admin separation should remain explicit:

- `ADMIN` remains operational. It can perform approved operational management and final lifecycle authority where currently allowed.
- `SUPER_ADMIN` owns future access-control configuration and system-owner settings.
- Role-management UI is deferred and should not be introduced in Phase 7A or 7B.
- System role rows should be treated as locked configuration unless the product owner explicitly approves a controlled mutation path.

## 9. Risks

- Circular module dependency risk: Phase 6 introduced `AccessControlModule` usage across several runtime modules. A DB-backed policy path could increase dependency pressure if it imports modules that already depend on access control.
- Stale DB permissions if the code catalog changes but seed/sync does not run.
- Over-permissioning custom roles, especially if future UI allows broad permission assignment without guardrails.
- Confusing `User.role` vs `AccessRole`: `User.role` controls persona/workspace/perimeter, while `AccessRole` should initially represent permission sets.
- Migration/seed drift between `SYSTEM_ROLE_PERMISSIONS` and database rows.
- Permission strings are not enforced by a foreign key if no `Permission` table exists.
- `kind`, `isSystem`, and `systemRole` invariants could drift unless enforced by seed validation and future database constraints.
- Custom role assignment could be mistaken for operational scope assignment. It must not replace `PickerBranchAssignment`, `VendorChampAssignment`, or `ChainAreaManagerAssignment`.

## 10. Recommended Decisions Needed

Product-owner decisions needed before Phase 7B:

- Should the permission catalog remain code-owned in Phase 7?
- Should `UserAccessRoleAssignment` be added in Phase 7D or deferred?
- Should custom roles be assignable to users in Phase 7 or only prepared?
- Should system role rows be locked from mutation?
- Should inactive `AccessRole` rows remain for audit/history?

Recommended default decisions:

- Keep the permission catalog code-owned in Phase 7.
- Defer `UserAccessRoleAssignment` until after DB-backed system roles are seeded and read safely.
- Prepare custom roles structurally, but do not assign them to users until a separate scoped phase.
- Lock system role rows from mutation outside seed/system sync.
- Keep inactive `AccessRole` rows for audit/history rather than deleting them.

## 11. Acceptance Criteria for Phase 7A

- Design document created.
- No production code changes.
- No Prisma schema changes.
- No migration files.
- No seed implementation.
- No UI changes.
- Clear recommendation for Phase 7B.

Phase 7B recommendation: add only `AccessRole`, `AccessRolePermission`, and supporting enums in Prisma, with no runtime behavior change and no user role assignment table yet.
