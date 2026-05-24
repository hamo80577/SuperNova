# SuperNova Access Control V1

## Product Context

SuperNova is a Partner Workforce Operations System.

It is not a generic HR ERP.

Core product:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

Current roles:

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

Current hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

## Problem

Some backend decisions currently depend directly on role names.

Examples of risky patterns:

```ts
actor.role === UserRole.ADMIN
actor.role === UserRole.AREA_MANAGER
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
approverRole: UserRole.AREA_MANAGER
```

This is acceptable for the MVP, but it will become painful when the product grows and needs roles such as:

```text
Operations Lead
Country Manager
Regional Manager
Client Admin
Support Admin
```

## Target Model

Keep roles, but reduce role-coupled business logic.

Target:

```text
Role = workspace/persona
Permission = allowed action
Scope = where action is allowed
Policy = decision using permission + scope + state
Workflow = sensitive lifecycle path
```

In short:

```text
Role-based UX
Permission-based backend decisions
Assignment-based scope
Workflow-based lifecycle changes
```

## Non-negotiable Rules

Do not remove or redesign these early:

```text
User.role
UserRole enum
RolesGuard
@Roles decorator
ApprovalStep enum
RequestApproval.approverRole
Current workflow services
```

They may remain as compatibility and perimeter layers while the new access model is introduced.

## Assignment Scope Must Stay

Do not store these as source-of-truth fields on User:

```text
chainId
vendorId
managerId
```

Operational scope must continue to come from assignment tables:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

## Workflow Rule

No permission may bypass lifecycle workflows.

Forbidden ideas:

```text
Direct Picker creation
Direct Picker transfer
Direct Picker deactivation/archive
Direct active Picker assignment edit
Bypass approval
```

Sensitive lifecycle changes must stay:

```text
Request -> Approval -> System applies change
```

## Admin vs Super Admin Direction

### Admin

Admin is an operational admin.

Admin can handle daily operational actions such as finalizing approved lifecycle requests and viewing operational reports.

### Super Admin

Super Admin is the system owner.

Super Admin controls access control, system settings, and future platform-level authority.

Preferred Access Control UI route:

```text
/super-admin/access-control
```

## Custom Roles Direction

Do not start with full custom roles UI.

Correct order:

```text
1. Define permission catalog in code.
2. Define current role-to-permission matrix in code.
3. Add a central AccessPolicyService.
4. Split Admin and Super Admin behavior.
5. Only then consider DB-backed custom roles and UI.
```

## Approval Direction

Do not rename current ApprovalStep enum values in this phase.

Instead, introduce an internal authority abstraction:

```text
AREA_MANAGER_APPROVAL = chain authority approval
SOURCE_AREA_MANAGER_APPROVAL = source chain authority approval
DESTINATION_AREA_MANAGER_APPROVAL = destination chain authority approval
ADMIN_FINAL_APPROVAL = final lifecycle authority
```

This lets future roles approve by authority and scope without rewriting workflow history.

## Tenant/Country Direction

Tenant and Country support are future concepts.

Do not add tenant/country tables in Access Control V1 unless explicitly requested later.

Design names should not block future tenant/country support, but the first implementation stays inside the current app shape.
