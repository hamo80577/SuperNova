# 08 — Code Quality Rules

## TypeScript Rules

Use strict TypeScript.

Avoid:

```text
any
unknown cast chains without validation
duplicated DTO shapes
large untyped payload mutations
```

Prefer:

```text
explicit DTOs
narrowed union types
small helper functions
validated parsing
clear return types for services
```

## Backend Rules

Controllers should be thin.

Services should own business logic.

Large workflow services should be split by responsibility.

Recommended split for workflows:

```text
workflow service
policy/scope service
payload parser
finalization service
notification service
audit helper
```

## Frontend Rules

Components should be readable and scoped.

Avoid:

```text
one giant component for whole page
duplicated API response types
business-rule-only frontend validation
hidden backend failures
```

Prefer:

```text
small sections
clear loading/error states
shared form controls
Zod validation matching backend DTOs
API client types
role-specific render helpers
```

## Naming Rules

Use operational names.

Good:

```text
NewHireWorkflowService
RequestApprovalRoutingService
PickerBranchAssignment
AdminFinalActions
BranchWorkspace
```

Bad:

```text
ManagerThing
StuffService
MainCard2
MagicHandler
```

## File Size Rule

If a file becomes hard to review, split it.

Signals:

```text
multiple workflows in one file
multiple unrelated forms in one component
private helper count too high
copy/paste branching everywhere
```

## Comments Rule

Use comments only for important business decisions.

Good:

```text
// Area Manager-created New Hire skips the Area Manager approval step because the actor is the responsible approver.
```

Bad:

```text
// increment i
```

## Error Copy Rule

Errors must help operations understand what to fix.

Good:

```text
Selected Branch is not active.
sourceVendorId is required for Champ New Hire candidate lookup.
```

Bad:

```text
Invalid request.
Failed.
```

## No Fake Data

Do not add fake metrics, fake names, fake branches, or fake workflow states in production pages.

Use empty states.
