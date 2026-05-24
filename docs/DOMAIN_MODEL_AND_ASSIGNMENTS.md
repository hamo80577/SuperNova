# Domain Model and Assignments

## Operational Hierarchy

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

The hierarchy is operational, not a set of foreign keys on `User`.

## User Role

`User.role` represents the SuperNova workspace/persona:

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

Attendance calculations apply only to users whose SuperNova role is:

```text
PICKER
CHAMP
```

Do not trust the attendance source file `Role` or `Designation` as source of truth.

## Assignment Tables

Use assignment tables as the authoritative operational scope:

```text
PickerBranchAssignment -> Picker to Branch
VendorChampAssignment -> Champ to Branch
ChainAreaManagerAssignment -> Area Manager to Chain
```

Assignment history must be preserved. Close old assignments and create new assignments through approved workflows.

## Forbidden User Fields

Do not add these as source-of-truth fields:

```text
User.chainId
User.vendorId
User.managerId
```

If a feature needs Branch, Champ, Chain, or Area Manager context, resolve it through assignment tables.

## Attendance Reporting Context

Picker attendance is calculated at user level and can roll up to Branch and Chain summaries.

Champ attendance is calculated at user level only.

Champ attendance must not be included in:

```text
Branch totals
Chain totals
Picker rollups
Area Manager Picker Attendance section
```

For historical accuracy, future implementation should evaluate whether attendance summaries need assignment context as of the attendance date, not only the current active assignment.
