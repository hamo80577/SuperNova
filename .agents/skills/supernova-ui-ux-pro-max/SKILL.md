---
name: supernova-ui-ux-pro-max
description: Use this skill for SuperNova UI/UX design, frontend UI engineering, responsive page redesign, component polish, shadcn/Tailwind implementation, accessibility, and screenshot-based UI review.
---

# SuperNova UI UX Pro Max

## Purpose

Design and implement SuperNova UI as a serious operational tool.

Use this skill for:
- page redesign
- UI review
- screenshot review
- frontend implementation
- component extraction
- responsive layout fixes
- mobile-first fixes
- accessibility improvements
- Tailwind/shadcn component work
- frontend-ui-engineering tasks

## UI Identity

SuperNova should feel:

- clean
- operational
- fast
- touch-friendly
- professional
- clear
- mobile-first

Avoid:
- fake SaaS dashboards
- random templates
- generic HR ERP feel
- decorative clutter
- fake metrics
- oversized cards with no operational value

## Frontend UI Engineering Principles

Use strong frontend engineering, not just pretty UI.

Focus on:
- component clarity
- predictable props
- reusable but not over-abstracted components
- clean state handling
- readable loading/error/empty states
- stable responsive layouts
- accessibility basics
- keyboard-friendly interactions
- clear form validation
- safe table/card behavior on mobile
- no horizontal overflow
- no fragile layout hacks

Prefer:
- shadcn/ui-style components
- Tailwind utility consistency
- typed component props
- small focused components
- extracted helpers only when duplication is real
- simple composition over clever abstraction

Avoid:
- component explosion
- one huge page component
- deeply nested conditional JSX
- repeated formatting logic everywhere
- hardcoded visual hacks
- magic pixel fixes
- hiding backend authorization issues in the frontend

## Mobile-First Rule

Design first for 360px-430px.

Required:
- no horizontal overflow
- touch-friendly buttons
- readable cards
- forms in clear sections
- tables become cards or controlled scroll
- dialogs usable on mobile
- primary actions obvious

Desktop can be denser, but must remain clean and responsive.

## Page-by-Page Rule

Work one page or one component group at a time.

Before coding:
1. Review current page/screenshot if available.
2. Identify UX problems.
3. Define target behavior.
4. Keep scope small.
5. Do not redesign unrelated pages.
6. Do not change backend logic unless explicitly required.

## Status UI

Use labels with colors. Do not rely on color alone.

Suggested meanings:
- success/completed: green
- processing: blue
- warning/needs attention: amber
- danger/failed: red
- neutral/archive: slate
- primary action: brand primary

## Workflow UI

Approval/request steps should use a clear stepper or timeline showing:
- label
- status
- owner/action role
- clear message

## Challenge Mode

If the requested UI is bad for users, say so and propose a better option.

If current UI is technically messy, duplicated, inaccessible, or not mobile-safe:
- report the issue
- propose a cleaner structure
- keep implementation scoped
- do not rewrite the whole UI at once

## Final Response Format

For UI implementation tasks, end with:

- Summary
- Page/Component Changed
- UX Problems Fixed
- Frontend Engineering Notes
- Files Changed
- Behavior Changes
- Responsive Checks
- Tests/Checks Run
- Manual Verification
- Known Risks
- Completion Status
- Next Recommendation
