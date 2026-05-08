# SuperNova Workflow Guardrails

## Operating Principle

Sensitive lifecycle changes must not happen through direct data edits. The enforced product pattern is:

```text
Request -> Approval -> Final Action -> System Applies Change
```

## Protected Lifecycle Actions

These actions must stay workflow-based:

- Picker creation
- Picker transfer
- Picker archive/deactivation
- Picker assignment changes

## New Hire

Target shape for later phases:

```text
Champ request
-> Area Manager approval
-> Admin approval
-> Admin enters Shopper ID
-> System creates Picker
-> System assigns Picker to source Vendor
-> System notifies Champ with temporary credentials
```

Phase 4 does not implement this flow.

## Resignation / Termination

Target shape for later phases:

```text
Champ request
-> Area Manager approval
-> Admin approval
-> System archives/deactivates Picker
-> System closes active assignment
-> System records block status
```

Phase 4 does not implement this flow.

## Transfer

Same chain:

```text
Champ request
-> Source Chain Area Manager approval
-> System transfers Picker
```

Cross chain:

```text
Champ request
-> Source Chain Area Manager approval
-> Destination Chain Area Manager approval
-> System transfers Picker
```

Phase 4 does not implement this flow.

## Phase 3 Assignment Setup Is Not Transfer

Admin assignment management in Phase 3 is setup tooling for the operational hierarchy only.

Allowed in Phase 3:

- create an active Picker -> Vendor assignment when no active Picker assignment exists
- create an active Vendor -> Champ assignment when no active Vendor Champ assignment exists
- create an active Chain -> Area Manager assignment when no active Chain Area Manager assignment exists
- close an active assignment while preserving its history row
- derive current management context from active assignment rows

Not allowed in Phase 3:

- automatic Picker transfer
- auto-closing old assignments during create
- request approval logic
- direct Picker creation screen
- lifecycle finalization actions

## Explicit MVP Exclusions

Do not add these to MVP unless explicitly requested:

- Payroll
- Attendance
- GPS tracking
- Order integration
- Microservices
- Advanced analytics

## Phase 4 Role Workspaces Are Read-Only

Phase 4 workspaces expose scoped operational visibility only:

- Picker can view own profile, branch, chain, Champ, and Area Manager context.
- Champ can view assigned branches and active Pickers under those branches.
- Area Manager can view assigned Chains, Vendors under those Chains, and assigned users under those Vendors.
- Admin can view system-wide operational counts and links to existing controlled management pages.

These workspaces must not bypass lifecycle workflows. New Hire, Transfer, Resignation/Termination, Request creation, and Approval decisions remain later phases.
