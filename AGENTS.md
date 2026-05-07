# AGENTS.md — SuperNova

## Project

SuperNova is a Talabat-style Partner Workforce Operations System.

It manages:

```text
Chains
Vendors/Branches
Pickers
Champs
Area Managers
Admins
Assignments
Requests
Approvals
Notifications
Audit Logs
```

This is not a generic HR ERP.

The product should be described as:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

## Required Stack

Use:

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Forms: React Hook Form + Zod
Deployment: Docker Compose
```

## Architecture Rule

Use a modular monolith.

Do not introduce microservices.

Do not put backend domain logic in frontend code.

Backend domain logic belongs in NestJS services/modules.

Prefer monorepo structure:

```text
apps/web
apps/api
packages/shared
prisma
docs
```

## Core Product Rule

Sensitive lifecycle operations must be request-based.

Do not implement direct manual edits for:

```text
Picker creation
Picker transfer
Picker archive
Picker assignment changes
```

Correct:

```text
Request → Approval → System applies change
```

## Hierarchy Rule

The hierarchy is:

```text
Picker → Vendor/Branch → Champ → Chain → Area Manager
```

Do not store `managerId` in User as the source of truth.

Derive managers from assignment tables.

## User Model Rule

Do not store these in User:

```text
chainId
vendorId
managerId
```

Use:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

## Workflow Rules

### New Hire

```text
Champ request
→ Area Manager approval
→ Admin approval
→ Admin enters Shopper ID
→ System creates Picker
→ System assigns Picker to source Vendor
→ System sends temp credentials to Champ
→ Picker changes password
→ Picker completes profile
```

### Resignation / Termination

```text
Champ request
→ Area Manager approval
→ Admin approval
→ System archives/deactivates Picker
→ System closes active assignment
→ System saves block status
```

### Transfer

Same Chain:

```text
Champ request
→ Source Chain Area Manager approval
→ System transfers Picker
```

Cross Chain:

```text
Champ request
→ Source Chain Area Manager approval
→ Destination Chain Area Manager approval
→ System transfers Picker
```

## Security Rules

Every backend action must validate:

```text
Auth
Role
Scope
Entity state
Request state
Approval ownership
```

Frontend hiding is not security.

## Quality Rules

Before changing code:

1. Inspect the existing repo.
2. Identify current architecture.
3. Make a short implementation plan.
4. Keep changes inside the requested phase.
5. Do not start future phases.
6. Update or add tests where relevant.
7. Run typecheck/build/tests where available.
8. Summarize changed files and risks.

## UI/UX Rules

Use professional operations dashboard design.

Use:

```text
shadcn/ui
Tailwind
Lucide icons
Clean cards
Data tables
Status badges
Timelines
Clear forms
```

When frontend work is requested, use available UI/UX tools/plugins/superpowers if present, especially:

```text
ui-ux-pro-max
```

If unavailable, do not fake tool usage. Apply equivalent standards manually.

## Forbidden

Do not:

```text
Use SQLite for production architecture
Introduce microservices
Create fake flows that bypass approvals
Allow direct Picker branch edits
Store age instead of dateOfBirth
Store raw passwords
Expose temporary passwords except in the Champ notification after final New Hire approval
Allow Admin to finalize New Hire without Shopper ID
Skip audit logs for sensitive actions
Add payroll, attendance, GPS, order integration, or advanced analytics to MVP unless explicitly requested
```

## Final Response Format for Codex

Always end with:

```text
Summary
Files Changed
Tests/Checks Run
Known Risks
Phase Completion Status
Next Recommended Step
```
