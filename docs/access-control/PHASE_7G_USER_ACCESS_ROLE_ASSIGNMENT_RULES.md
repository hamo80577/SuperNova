# Phase 7G User Access Role Assignment Rules

## Purpose

Phase 7G adds a database guard for future `UserAccessRoleAssignment` usage and documents assignment semantics before any runtime authorization, API, or UI starts using the table.

This phase does not change runtime authorization behavior. `UserAccessRoleAssignment` remains inert.

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

Access role assignments are intended to be additive in future phases.

Base permissions from `User.role` remain the foundation. Active user access-role assignments may later add extra permissions, but they must not remove base system-role permissions.

Future runtime behavior must define clear merge rules before this table is read by `AccessPolicyService`.

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

Do not manually assign SYSTEM `AccessRole` rows to users unless a later phase explicitly approves that product behavior.

Future custom role assignment should normally use CUSTOM `AccessRole` rows.

System role permission rows should continue to be synchronized from `SYSTEM_ROLE_PERMISSIONS` until a later phase explicitly changes ownership.

## Picker To Champ Transition

Picker to Champ is not solved by `UserAccessRoleAssignment`.

Picker to Champ changes `User.role`, workspace/persona behavior, operational responsibilities, and assignment-table scope. It needs a separate Role Transition or Admin-controlled workflow design.

Access-role assignment must not be used as a shortcut for role transition.

## Future Runtime Requirements

Before `UserAccessRoleAssignment` affects authorization, define:

- who can assign CUSTOM access roles
- whether SYSTEM access roles are assignable at all
- audit behavior for assignment create/revoke
- active-only assignment write behavior
- cache refresh or restart expectations for permission changes
- conflict rules when custom permissions overlap with system permissions
- product guardrails for high-risk lifecycle and access-control permissions

Until those decisions are implemented, `UserAccessRoleAssignment` remains schema foundation only.
