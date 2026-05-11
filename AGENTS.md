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
Current development: local PostgreSQL + npm workspaces
Architecture: modular monolith
```

Do not introduce microservices.

Docker files have been removed from the repo and Docker is not part of the current development workflow.

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

SuperNova UI must be designed mobile-first because most users are Pickers and Champs using phones.

Mobile-first rules:

- Design for 360px-430px width first.
- No horizontal overflow.
- No random content outside the visible frame.
- No oversized cards that break mobile screens.
- Forms must be easy to complete with one hand.
- Buttons must be large enough for touch.
- Inputs must be clear and tall enough.
- Critical actions must be visible without hunting.
- Tables must become cards or horizontally scroll safely on mobile.
- Sidebars must not destroy mobile layout.
- Text must be short, direct, and operational.
- Avoid dense desktop-only layouts for Champ/Picker screens.
- Admin/Area Manager can have denser desktop layouts, but mobile must still not break.
- Every page redesign must include mobile visual verification.

Login page rule:

- The Login page must be mobile-first, clean, orange-accented, simple, and direct.
- The Login page may use a creative illustration panel on desktop, but it must not become crowded or dashboard-like.

For every page redesign:

1. Inspect the existing page and related components.
2. Produce a short UI/UX audit.
3. Produce a specific page layout plan.
4. Change only the target page and shared components that are necessary.
5. Do not change backend logic.
6. Do not change workflow behavior.
7. Do not add new product features.
8. Run checks.
9. Verify mobile layout, desktop layout, no horizontal overflow, touch-friendly controls, clear primary action, and no broken responsive behavior.
10. Provide before/after summary and known risks.

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
Claim local PostgreSQL/app verification passed unless it was actually run
```

## Verification Tier Policy

Use the lightest verification tier that matches the actual change. Current development uses local PostgreSQL and npm scripts. Do not ask to use Docker for normal work.

### Tier 1 — Docs-only

Use for documentation or instruction edits only.

Do not run app startup, Prisma, build, lint, or typecheck unless explicitly requested.

Allowed lightweight checks:

```text
git diff
git status
git diff --check
```

### Tier 2 — UI-only lightweight

Use for frontend-only visual page/component work such as spacing, colors, layout, copy, cards, tables, badges, responsive styling, shadcn/Tailwind polish, and frontend-only page composition.

Required checks:

```text
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
```

Run only when the UI change is structural or before final page acceptance:

```text
npm run build --workspace @supernova/web
```

Do not run for normal UI-only work:

```text
prisma migrate
prisma db seed
database reset
full-stack restart
```

### Tier 3 — Frontend behavior

Use when frontend changes touch auth routing, protected route behavior, login redirect behavior, API client usage, or cookie/auth UI interaction.

Run:

```text
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
npm run build --workspace @supernova/web
```

Do not run local PostgreSQL/Prisma setup unless backend, API, auth server, database, or environment files were changed.

### Tier 4 — Backend/full-stack

Use local PostgreSQL full-stack verification when changes touch:

```text
apps/api
prisma
.env examples
auth backend/cookies/session behavior
API contracts
database migrations
request/approval/workflow backend logic
reports backend logic
deployment/runtime config
```

Backend/full-stack verification may include:

```text
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run build
npm run dev
GET http://localhost:4000/api/health
GET http://localhost:3000/login
```

Do not use `prisma db push` as the normal path.

### Existing Local Environment Rule

If the user says the local app is already running, use that existing environment for manual browser verification. Do not stop or restart local services unless the current task requires backend/full-stack verification.

```text
http://localhost:3000
http://localhost:4000
```

### Final Response Rule

For every future task, state which verification tier was used:

```text
Docs-only
UI-only lightweight
UI structural
Frontend behavior
Backend/full-stack
```

Also state why local PostgreSQL/app startup was or was not run.

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
Local PostgreSQL/App Verification
Manual Regression Verification
Security/Hardening Review
Known Risks
Completion Status
Next Recommended Step
```
