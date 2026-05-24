# Product Scope and Guardrails

## Product Boundary

SuperNova exists for partner workforce operations.

It must stay focused on:

```text
Assignments
Requests
Approvals
Role-based Workspaces
Operational reports
Auditability
```

It must not become a generic HR ERP.

## Architecture Guardrails

Use the existing modular monolith.

Do not add:

```text
microservices
standalone attendance service
separate payroll service
separate sync worker service
```

New backend capabilities should be added as focused NestJS modules inside `apps/api`.

## Source-of-Truth Guardrails

Operational hierarchy belongs in assignment tables.

Use:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Do not add source-of-truth hierarchy fields to `User`:

```text
User.chainId
User.vendorId
User.managerId
```

`User.role` remains the SuperNova persona and workspace role. It is not replaced by attendance file role labels.

## Workflow Safety

Sensitive lifecycle changes must follow:

```text
Request -> Approval -> System applies change
```

Do not bypass workflows for:

```text
Picker creation
Picker transfer
Picker archive/deactivation
active Picker assignment edit
role changes
assignment changes
```

## Attendance Import Guardrails

Attendance imports must never:

```text
create users
transfer users
archive users
deactivate users
change assignments
change User.role
change User.shopperId
change User.ibsId
change employmentStatus
change accountStatus
```

Attendance can only import source rows, match existing users, calculate metrics, store approved records/summaries, and report scoped analytics.

## Attendance Forbidden Scope

Do not add:

```text
payroll
payroll deductions
salary calculations
GPS
live tracking
biometric integration
live punch-in/out
order integration
inventory
accounting
generic ERP modules
```

## Data Retention Guardrails

Do not permanently store uploaded attendance files.

Allowed to persist:

```text
fileName
fileHash
import metadata
counts
warnings/errors
calculated records
compressed summaries
```

Forbidden:

```text
permanent original XLSX file storage
all historical raw rows forever
```
