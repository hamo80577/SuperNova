# Access Control and Permissions

## Current Direction

SuperNova uses:

```text
Role-based UX
Permission-based backend decisions where available
Assignment-based scope
Workflow-based lifecycle changes
```

`User.role` remains the primary persona/workspace field.

Operational scope must come from assignment tables.

## Existing Access-Control History

Historical access-control planning, audit, stabilization, and regression records remain under:

```text
docs/access-control/
```

Those files are historical records. Future work must inspect current code before changing access-control behavior.

## Attendance Operations Access

The future Super Admin attendance operations page should be:

```text
Route: /super-admin/attendance-operations
Page name: Attendance Data Operations
Access: SUPER_ADMIN only
```

Phase 0 does not modify access-control code.

## Attendance Reporting Access

Future reporting should be role-scoped:

```text
SUPER_ADMIN / ADMIN -> operational attendance reporting as approved
AREA_MANAGER -> assigned Chain scope only
CHAMP -> assigned Branch scope only where approved
PICKER -> no attendance analytics workspace unless explicitly approved
```

Area Manager attendance UI must separate:

```text
Picker Attendance
Champ Attendance
```

Champ rows must never be mixed into Picker Branch or Chain totals.

## Backend Enforcement

Frontend hiding is not security.

Every future attendance endpoint must validate:

```text
authentication
role or permission
assignment scope
period boundaries
operation mode
entity state where relevant
audit logging for destructive/recalculate/compress operations
```
