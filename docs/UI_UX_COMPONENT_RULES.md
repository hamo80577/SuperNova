# UI/UX Component Rules — SuperNova

## Purpose

This file defines reusable UI rules for SuperNova page-by-page redesign.

## Page Header

Every main page should have a clear header:

```text
Title
Short operational description
Primary action if applicable
Context badges if useful
```

Good examples:

```text
Admin Control Center
Branch Workspace
Request Detail
Pending Final Actions
```

## Sidebar Navigation

Rules:

- Group links logically.
- Active item must be obvious.
- Disabled items must not look clickable.
- Do not use `href="#"` for real navigation.
- Picker should not see Admin/Champ/Area Manager controls.
- Use role-specific navigation.

Recommended groups:

```text
Workspace
Operations
Requests & Approvals
Reports
Admin Controls
Settings
```

## Cards

Use cards for grouped information.

Card rules:

- Clear title.
- Short description where useful.
- Consistent padding.
- Soft border.
- No useless decorative cards.
- No placeholder cards unless clearly marked as placeholder.

## Tables

Use tables for operational lists.

Table rules:

- Wrap tables in a clean card.
- Use horizontal overflow for small screens.
- Use badges for statuses.
- Keep row actions on the right.
- Use empty states.
- Use filters where useful.
- Avoid tiny unreadable columns.

## Status Badges

Statuses should be visually consistent.

Status categories:

```text
Active / Complete / Approved -> success
Pending / Requires Action -> warning
Rejected / Blocked / Terminated -> danger
Archived / Closed / History -> neutral
```

Avoid random status colors.

## Forms

Forms must be clear and operational.

Rules:

- Put entity context at the top.
- Make required fields obvious.
- Use clear validation messages.
- Put review section before submit for workflow forms.
- Primary submit button should be clear.
- Cancel/back action should be secondary.
- Dangerous/final actions should be visually separated.

## Workflow Forms

Workflow forms should show:

```text
Source context
Target Picker/Candidate
Approval path
Reason/notes
Review before submit
```

## Request Detail

Request detail should show:

```text
Request type/status
Current required action
Source Branch/Chain
Destination Branch/Chain if transfer
Target user/candidate
Approval steps
Timeline/history
Final result summary if completed
```

## Empty States

Empty states must explain the situation and next action.

Bad:

```text
No data
```

Good:

```text
No pending final actions. New Hire and Offboarding requests will appear here when they are waiting for Admin finalization.
```

## Loading States

Loading states should be calm and clear.

Do not show broken blank pages while loading.

## Error States

Error states should:

- show a clear message
- not expose raw backend internals
- offer retry/back action when useful

## Action Hierarchy

Use action priority:

```text
Primary action: solid button
Secondary action: outline/ghost
Destructive action: danger styling
Read-only link: subtle
```

Do not put many equal-looking buttons next to each other.

## Spacing and Radius

Recommended:

```text
Page padding: consistent
Card radius: medium/large
Input height: 46-50px for major forms
Button height: 44-48px for primary forms
Cards: enough padding for readability
```

## Responsive Behavior

Rules:

- Desktop sidebar should be stable.
- Small screens should not break.
- Tables scroll horizontally.
- Cards stack.
- Forms remain usable.
- No horizontal page overflow.

## Icons

Use Lucide icons.

Rules:

- Icons support meaning.
- Do not overuse icons.
- Do not use random decorative icons.
- Keep icon size consistent.

## Copy

Use operational wording.

Preferred:

```text
Open Branch Workspace
Pending Final Actions
Approval path
Assignment history
Current required action
```

Avoid:

```text
Magic dashboard
Empower everything
Click here
Awesome data
```
