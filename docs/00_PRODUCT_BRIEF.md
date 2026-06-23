# SuperNova Product Brief

## Product Identity

SuperNova is a Talabat-style Partner Workforce Operations System.

It is built around:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

It is not a generic HR ERP.

## Product Problem

Partner workforce operations need role-scoped control over who works where, who can request lifecycle changes, who approves them, and what the system records after approval.

SuperNova solves that with:

- Assignment source-of-truth records.
- Request and approval workflows.
- Role-based workspaces for Pickers, Champs, Area Managers, Admins, and Super Admins.
- Notifications and audit logs for operational handoff.
- Reports and admin controls for controlled visibility.

## Current Mode

Current mode: official product development and production hardening.

The foundation is mostly built. Future work must harden, polish, and extend the official product in small scoped slices. Old prompts, one-off plans, and branch notes are not product authority.

## Official Core Areas

- Authentication.
- Role-based workspaces.
- Organization setup.
- Users.
- Assignments.
- New Hire workflow.
- Picker Profile Completion.
- Resignation / Offboarding workflow.
- Transfer workflow.
- Requests.
- Approvals.
- Notifications.
- Audit logs.
- Reports.
- Admin controls.
- Access-control foundation.

## Roles

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

## Operational Hierarchy

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Operational scope comes from assignment records, not hierarchy fields stored on `User`.

## Product Principles

- Workflow safety over direct mutation.
- Backend-enforced access control over frontend hiding.
- Assignment history over destructive updates.
- Clear operational copy over generic SaaS language.
- Real data or honest empty states over fake metrics.
- Mobile-first layouts for field operations.

## Out Of Scope Unless Approved

Do not add or document as current scope:

```text
Payroll
Salary calculations
Payroll deductions
Attendance penalty automation
GPS
Live tracking
Order integration
Inventory
Accounting
POS
Generic ERP modules
Biometric attendance
Live punch-in / punch-out app
Microservices
```

Existing reporting/import surfaces must stay bounded. Their existence does not authorize broad ERP, payroll, live tracking, or order-integration expansion.
