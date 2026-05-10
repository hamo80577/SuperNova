# UI/UX Direction — SuperNova

## Goal

SuperNova must look and feel like a professional partner workforce operations system.

The backend works. The next goal is to make the product visually usable, clear, and credible.

## Product Feel

Target feel:

```text
Operations control system
Branch-first workflow tool
Role-based operational workspace
Admin control center
```

Avoid:

```text
Generic HR SaaS
Toy dashboard
Random template
Overly empty pages
Unclear action placement
Feature cards with no operational meaning
```

## Visual Direction

Preferred direction:

```text
Light operations dashboard
Clean neutral background
White cards
Soft borders
Clear status colors
Dense but readable tables
Strong page headers
Branch-first context blocks
Timeline and approval path visibility
```

## Design Priorities

1. Mobile-first usability.
2. Clarity.
3. Operational speed.
4. Correct action placement.
5. Strong hierarchy.
6. Consistent components.
7. Safe workflow messaging.
8. Role-specific experience.

## Mobile-First Rule

SuperNova UI must be designed mobile-first because most users are Pickers and Champs using phones.

Mobile-first requirements:

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

## Login Page Direction

The Login page must be mobile-first, clean, orange-accented, simple, and direct.

It may use a creative illustration panel on desktop, but it must not become crowded or dashboard-like.

## Role-Specific UX

### Picker

Simple and guided.

Main needs:

- profile status
- current Branch
- Champ
- Area Manager
- requests
- profile completion

### Champ

Branch-first.

Main needs:

- assigned Branches
- active Pickers
- branch actions
- submitted requests
- notifications
- reports

### Area Manager

Chain-scoped operations.

Main needs:

- assigned Chains
- branch/user visibility
- pending approvals
- request history
- manpower counts

### Admin

Dense control center.

Main needs:

- pending final actions
- archived users
- audit logs
- chains/vendors/assignments
- reports
- settings placeholders

## Page-by-Page Rule

Do not redesign everything at once.

Process:

```text
Screenshot
-> UI review
-> Product owner feedback
-> page-specific layout plan
-> Codex prompt
-> implementation
-> screenshot review
-> next page
```

Each page redesign must verify:

- mobile layout
- desktop layout
- no horizontal overflow
- touch-friendly controls
- clear primary action
- no broken responsive behavior

Use the verification tier policy from `AGENTS.md` and `docs/TECHNICAL_GUARDRAILS.md`.

For UI-only visual changes, run only the web typecheck/lint tier unless the page is structurally changed or ready for final acceptance. Do not rebuild, restart, reseed, or reset Docker/PostgreSQL for UI-only redesign work.

If the local app is already running, use the existing `http://localhost:3000` environment for browser verification instead of recreating containers.

## Interaction Rules

- Primary action should be obvious.
- Destructive/final actions should be visually separated.
- Disabled/planned actions should not look clickable.
- Workflow status must be visible.
- The user should always know what entity context they are acting in.
- Branch context must be visible before lifecycle actions.

## Copy Rules

Use clear operational English.

Avoid vague marketing text.

Good:

```text
Open Branch Workspace
Pending Admin Final Actions
Transfer approval path
Source Branch
Destination Branch
Assignment history
```

Bad:

```text
Manage everything seamlessly
Empower workforce excellence
Click here
Action center
```

## Color Rules

Use color for meaning.

Recommended:

```text
Primary: controlled brand accent
Success: completed/active/approved
Warning: pending/requires action
Danger: rejected/blocked/terminated
Neutral: inactive/history/system info
```

Do not overuse random colors.

## Layout Rules

- Use strong page headers.
- Use cards for grouped information.
- Use tables for lists.
- Use timelines for workflow history.
- Use side panels for current required action where helpful.
- Keep spacing consistent.
- Avoid huge empty whitespace.
- Avoid cramped controls.
- Start layouts from mobile constraints, then expand to tablet and desktop.
