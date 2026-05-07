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

Phase 0 does not implement this flow.

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

Phase 0 does not implement this flow.

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

Phase 0 does not implement this flow.

## Explicit MVP Exclusions

Do not add these to MVP unless explicitly requested:

- Payroll
- Attendance
- GPS tracking
- Order integration
- Microservices
- Advanced analytics
