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

1. Clarity.
2. Operational speed.
3. Correct action placement.
4. Strong hierarchy.
5. Consistent components.
6. Safe workflow messaging.
7. Role-specific experience.

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
