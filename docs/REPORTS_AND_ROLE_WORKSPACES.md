# Reports and Role Workspaces

## Current Reporting Rule

Reports are read-only and must not mutate product state.

Existing report concepts are role-scoped for Admin, Area Manager, and Champ views.

## Attendance Reporting Direction

Attendance Analytics extends reporting with calculated attendance metrics and compressed historical summaries.

It must not become payroll or live tracking.

## Picker Attendance

Picker attendance:

```text
calculated at user level
included in Branch totals
included in Chain totals
visible in role-scoped reporting where authorized
```

## Champ Attendance

Champ attendance:

```text
calculated at user level only
shown separately
never included in Branch totals
never included in Chain totals
never mixed with Picker rows in Area Manager UI
```

## Area Manager Workspace Rule

Area Manager attendance reporting must have separate sections:

```text
Picker Attendance
Champ Attendance
```

Picker totals can reflect assigned Chain scope.

Champ metrics should appear as separate user-level summaries and should not alter Picker rollups.

## Super Admin Operations Workspace

Super Admin Attendance Data Operations is not a normal report page.

It is a data operations page for:

```text
uploading attendance source files
viewing import history
running data maintenance
reviewing calculation rules
```

It must show warnings/issues clearly and audit dangerous operations.
