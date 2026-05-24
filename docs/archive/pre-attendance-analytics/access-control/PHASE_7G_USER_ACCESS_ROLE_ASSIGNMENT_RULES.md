# Phase 7G User Access Role Assignment Rules

## Purpose

Phase 7G adds a database guard for `UserAccessRoleAssignment` usage and documents assignment semantics before any mutation API or UI starts using the table.

As of Phase 7H, `AccessPolicyService` reads ACTIVE CUSTOM `UserAccessRoleAssignment` rows at startup as additive user-specific permission grants.

This does not add custom-role assignment mutation APIs, role-management UI, or role-transition behavior.

Manual DB changes to CUSTOM access roles or user assignments can affect authorization after API restart. Until audited APIs exist, those changes must be treated as privileged operational database changes.

## User Role Remains Primary Persona

`User.role` remains the primary workspace and persona field.

`UserAccessRoleAssignment` must not:

- change login redirects
- convert a Picker to a Champ
- create operational responsibilities
- replace existing `@Roles` perimeter checks
- replace role-based workspace behavior

Operational role transitions are separate product actions, not access-role assignments.

## Additive Permission Grants Only

Access role assignments are additive.

Base permissions from `User.role` remain the foundation. Active CUSTOM user access-role assignments may add extra permissions, but they must not remove base system-role permissions.

`AccessPolicyService` checks base system-role permissions first and then checks additive CUSTOM grants for the actor's user id.

CUSTOM grant permissions must:

- exist in the code-owned permission catalog
- have `assignable === true`
- have `systemOnly !== true`

If any active CUSTOM assignment contains an unknown, non-assignable, or system-only permission, the custom assignment cache is ignored and base system-role permissions still apply.

## Operational Scope Remains Assignment-Table Based

Operational scope remains sourced from assignment tables:

- `PickerBranchAssignment`
- `VendorChampAssignment`
- `ChainAreaManagerAssignment`

Access-role assignments must not create or imply Chain, Branch, Picker, Champ, or Area Manager operational scope.

## Workflow Safety Remains Required

Extra permissions must not bypass lifecycle workflows.

Sensitive lifecycle changes must continue to use:

```text
Request -> Approval -> System applies change
```

Access-role assignments must not enable direct Picker creation, direct Picker transfer, direct Picker archive/deactivation, direct active assignment edits, approval bypass, or finalization bypass.

Existing workflow services remain responsible for validation, scope, state transitions, audit, notifications, and lifecycle mutations.

## Active Assignment Rule

Only one ACTIVE `UserAccessRoleAssignment` row is allowed for a given user/access-role pair.

The database enforces this with a PostgreSQL partial unique index:

```sql
CREATE UNIQUE INDEX "UserAccessRoleAssignment_active_user_role_unique"
ON "UserAccessRoleAssignment"("userId", "accessRoleId")
WHERE "status" = 'ACTIVE';
```

Revoking or closing an assignment should mark the current row `INACTIVE` and set `endsAt`.

Historical rows should remain available. Multiple INACTIVE rows for the same user/access-role pair are allowed.

## System Roles

SYSTEM `AccessRole` rows are seed/system-managed.

SYSTEM user access-role assignments are ignored by `AccessPolicyService` in this phase.

Do not manually assign SYSTEM `AccessRole` rows to users unless a later phase explicitly approves that product behavior.

Custom role assignment should use CUSTOM `AccessRole` rows.

System role permission rows are code-owned mirrors:

- `SYSTEM_ROLE_PERMISSIONS` is the source of truth.
- `prisma/access-role-seed.ts` syncs DB SYSTEM permission rows from the code matrix.
- Running `npm run db:seed` will sync DB SYSTEM permissions back to the code matrix.
- Do not manually edit SYSTEM role permission rows in the database in this phase.
- DB-owned SYSTEM role management is a future explicit decision.

## Picker To Champ Transition

Picker to Champ is not solved by `UserAccessRoleAssignment`.

Picker to Champ changes `User.role`, workspace/persona behavior, operational responsibilities, and assignment-table scope. It needs a separate Role Transition or Admin-controlled workflow design.

Access-role assignment must not be used as a shortcut for role transition.

## Future Runtime Requirements

Before adding mutation APIs or UI for `UserAccessRoleAssignment`, define:

- who can assign CUSTOM access roles
- audit behavior for assignment create/revoke
- active-only assignment write behavior
- cache refresh or restart expectations for permission changes
- conflict rules when custom permissions overlap with system permissions
- product guardrails for high-risk lifecycle and access-control permissions
- whether SYSTEM access roles are ever assignable to users

Until those decisions are implemented, `UserAccessRoleAssignment` remains read-only runtime foundation with no mutation API or UI.
