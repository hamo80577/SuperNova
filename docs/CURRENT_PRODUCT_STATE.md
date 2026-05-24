# Current Product State

## Product Identity

SuperNova is a Talabat-style Partner Workforce Operations System.

It is not a generic HR ERP.

The product manages operational workforce lifecycle through:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

## Required Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Architecture: modular monolith
Deployment: Docker Compose / VPS when deployment work is explicitly requested
```

Do not introduce microservices.

## Core Product Model

Operational hierarchy:

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Source-of-truth assignment tables:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Do not store operational hierarchy as source-of-truth fields on `User`.

Forbidden source-of-truth fields:

```text
User.chainId
User.vendorId
User.managerId
```

## Active Product Scope

Current workflow families:

```text
New Hire / User Onboarding
Resignation
Transfer
Profile Completion
Admin Controls
Reports
Notifications
Audit Logs
```

Resignation is the only active offboarding lifecycle unless the product owner explicitly expands scope.

## Approved Expanded Workstream

Attendance Analytics is approved as a scoped product workstream.

Approved attendance scope:

```text
data import
metric calculation
compressed historical summaries
role-scoped reporting
Super Admin data operations
```

Attendance is not payroll, live tracking, biometric attendance, order integration, inventory, accounting, or generic ERP behavior.

## Current Phase

Phase 0 is documentation and repo alignment only.

Phase 0 does not implement:

```text
product code
Prisma schema
migrations
API modules
UI pages or routes
runtime behavior
access-control logic
```
