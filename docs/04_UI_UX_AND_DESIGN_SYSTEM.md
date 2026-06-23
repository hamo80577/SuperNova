# UI/UX And Design System

## Design Identity

SuperNova must feel:

```text
Operational
Clean
Fast
Professional
Mobile-first
Touch-friendly
Clear
```

Avoid:

```text
Fake SaaS dashboards
Toy HR dashboards
Random template clutter
Decorative noise
Fake metrics
Unscoped global data for scoped roles
Horizontal overflow
```

## Mobile First

Design first for:

```text
360px
390px
430px
```

Mobile-critical pages must provide:

- No horizontal overflow.
- Touch-friendly controls.
- Readable cards.
- Clear form sections.
- Usable dialogs or bottom sheets.
- Visible primary action.
- Responsive table alternatives when dense tables would overflow.

## Components

Use:

```text
Cards
Tables
Badges
Forms
Dialogs
Tabs
Steppers/timelines
Empty states
Clear action hierarchy
```

Use tables for dense admin data and cards/lists for mobile views when tables would be unreadable.

Use badges for status. Do not rely on color alone.

## Workflow UI

Request and approval screens should show:

- Request type.
- Status.
- Current required action.
- Creator.
- Target user/candidate.
- Source Branch/Chain.
- Destination Branch/Chain when relevant.
- Approval steps.
- Timeline.
- Final result summary.

Forms should include:

- Entity context.
- Required fields.
- Validation messages.
- Approval path preview.
- Review before submit where useful.
- Safe cancel/back action.

## Copy Style

Use operational copy.

Good:

```text
Selected Branch
Approval path
Pending Admin Finalization
Open User Profile
Temporary password available in profile
```

Bad:

```text
Empower your team
Magic workforce experience
Click here
```

## Data Honesty

Never show fake production metrics, fake branches, fake users, fake workflow states, fake deltas, or fake targets.

If data is missing, use:

- Empty states.
- Loading states.
- Error states.
- Clear unavailable copy.

## Engineering Standards

Prefer:

- shadcn/ui-style primitives already present in the app.
- Tailwind utility consistency.
- Typed component props.
- Small focused components.
- Extracted helpers only when duplication is real.
- Simple composition over clever abstraction.

Avoid:

- One huge page component.
- Component explosion.
- Deeply nested conditional JSX.
- Repeated formatting logic.
- Magic pixel fixes.
- Frontend-only authorization.

## Verification

Every UI task must state:

```text
Mobile widths checked
Desktop checked
No horizontal overflow
Primary action visible
Loading state checked
Error state checked
Empty state checked
```

Local reusable UI guidance lives in:

```text
.agents/skills/supernova-ui-ux-pro-max/SKILL.md
.claude/skills/supernova-ui-ux-pro-max/SKILL.md
```
