# AGENTS.md — SuperNova

## Current Mission

SuperNova is a Talabat-style Partner Workforce Operations System.

It is not a generic HR ERP.

The current product is:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

The MVP backend logic and core workflows are complete. The next major workstream is page-by-page UI/UX improvement without changing workflow logic.

## Current Stack

```text
Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
Backend: NestJS + TypeScript
Database: PostgreSQL
ORM: Prisma
Forms/validation: React Hook Form + Zod on frontend, DTO validation on backend
Deployment: Docker Compose / VPS-ready structure
Architecture: modular monolith
```

Do not introduce microservices.

## Core Hierarchy

```text
Picker -> Vendor/Branch -> Champ -> Chain -> Area Manager
```

Rules:

- Picker active manager context is derived from active branch assignment.
- A Branch/Vendor is assigned to a Champ through `VendorChampAssignment`.
- A Chain is assigned to an Area Manager through `ChainAreaManagerAssignment`.
- A Champ can manage branches across multiple Chains.
- A Champ can therefore have different Area Managers depending on branch/chain context.
- Do not store `managerId`, `vendorId`, or `chainId` as source-of-truth fields on `User`.

## Completed MVP Workflows

### New Hire

```text
Champ submits New Hire from selected Branch
-> Area Manager approves/rejects
-> Admin finalizes with Shopper ID
-> System creates Picker
-> System creates active PickerBranchAssignment
-> System notifies Champ with phone + temporary password
-> Picker logs in
-> Picker changes password
-> Picker completes profile
```

### Picker Profile Completion

```text
Picker logs in
-> mustChangePassword is handled first
-> incomplete profile redirects to profile completion
-> Picker fills allowed safe fields only
-> profileStatus becomes COMPLETE
-> Picker can access workspace
```

### Resignation / Termination

```text
Champ submits from selected Branch
-> Area Manager approves/rejects
-> Admin finalizes with block status
-> System archives/deactivates Picker
-> System closes active PickerBranchAssignment
-> System disables login
-> Audit logs are created
```

### Transfer

Same Chain:

```text
Champ submits from selected Branch
-> Source Chain Area Manager approves
-> System closes old active assignment
-> System creates new active assignment
```

Cross Chain:

```text
Champ submits from selected Branch
-> Source Chain Area Manager approves
-> Destination Chain Area Manager approves
-> System closes old active assignment
-> System creates new active assignment
```

## Hard Product Rules

Never add direct manual edits for:

```text
Picker creation
Picker transfer
Picker archive/deactivation
Picker active branch assignment change
```

Sensitive lifecycle changes must stay:

```text
Request -> Approval -> System applies change
```

Generic request creation must not bypass Branch-first workflow rules.

## Security Rules

Every protected backend mutation must validate:

```text
Authentication
Role
Operational scope
Entity state
Request state
Approval step ownership
Audit logging
```

Frontend hiding is not security.

## UI/UX Redesign Rules

Future UI work must be page-by-page.

Do not ask Codex to "improve the UI" globally.

For every page redesign:

1. Inspect the existing page and related components.
2. Produce a short UI/UX audit.
3. Produce a specific page layout plan.
4. Change only the target page and shared components that are necessary.
5. Do not change backend logic.
6. Do not change workflow behavior.
7. Do not add new product features.
8. Run checks.
9. Provide before/after summary and known risks.

The product owner decides the final visual direction page by page.

## Current UI/UX Direction

SuperNova should feel like a professional operations control system:

- Branch-first operations.
- Dense but clean admin control surfaces.
- Clear workflow status.
- Serious operational dashboards.
- Tables, cards, filters, badges, timelines.
- No toy HR app look.
- No generic SaaS template look.
- No random colors.
- No fake numbers.

## Forbidden

Do not:

```text
Use SQLite for production architecture
Introduce microservices
Add payroll, attendance, GPS, order integration, or generic ERP modules unless explicitly requested
Create fake flows that bypass approvals
Allow direct Picker branch edits
Store age instead of dateOfBirth
Store raw passwords
Expose temporary passwords except in the Champ notification after New Hire finalization
Expose passwordHash in any API response
Allow Admin to finalize New Hire without Shopper ID
Skip audit logs for sensitive lifecycle actions
Commit local-only environment values
Claim Docker/PostgreSQL verification passed unless it was actually run
```

## Verification Rules

For UI-only work:

```text
npm run typecheck
npm run lint
npm run build
```

For backend, Prisma, auth, API, database, protected route, assignment, request, approval, notification, audit, admin, or report changes:

```text
docker compose up -d postgres
docker compose ps
docker compose logs postgres --tail=80
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
docker compose --profile app build --progress=plain
docker compose --profile app up -d --force-recreate api web
GET http://localhost:4000/api/health
GET http://localhost:3000/login
```

Do not use `prisma db push` as the normal path.

## Current Main Workstream

```text
Page-by-page UI/UX redesign
```

Current recommended order:

1. Login page
2. Admin dashboard
3. Champ Branch Detail
4. Request Detail
5. New Hire Form
6. Transfer Form
7. Offboarding Forms
8. Area Manager Dashboard
9. Reports Pages
10. Picker Dashboard / Profile Completion

## Required Final Response Format for Codex

For UI/UX work:

```text
Summary
Files Changed
UI/UX Audit Findings
Design Decisions
Tests/Checks Run
Manual UI Verification
Known Risks
Completion Status
Next Page Recommendation
```

For backend or full-stack work:

```text
Summary
Files Changed
Tests/Checks Run
Local Docker/PostgreSQL Verification
Manual Regression Verification
Security/Hardening Review
Known Risks
Completion Status
Next Recommended Step
```
