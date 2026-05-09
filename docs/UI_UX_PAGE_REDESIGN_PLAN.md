# UI/UX Page Redesign Plan — SuperNova

## Purpose

This file defines the page-by-page UI/UX redesign order.

The backend logic works. The product owner wants to reshape the UI page by page until it matches the intended product vision.

## Working Method

For each page:

```text
1. Open current page
2. Capture screenshot
3. Identify visual/UX problems
4. Define target layout
5. Write Codex prompt for that page only
6. Implement
7. Run checks
8. Review new screenshot
9. Iterate if needed
10. Move to next page
```

Do not redesign multiple unrelated pages at once.

## Global Rules

For every page redesign:

- Do not change workflow logic.
- Do not change backend behavior unless explicitly required.
- Do not add product features.
- Do not break existing routes.
- Do not fake data.
- Use existing APIs where possible.
- Keep changes scoped.

## Redesign Order

## 1. Login Page

Route:

```text
/login
```

Purpose:

- First impression.
- Clear product identity.
- Secure access.

Problems to check:

- Weak brand panel.
- Small/unclear card.
- Poor spacing.
- Missing show/hide password.
- Missing remember-me UX.
- Weak reset password guidance.

Must not change:

- role redirects
- auth guard behavior
- workflow behavior

Manual review required:

- desktop screenshot
- mobile screenshot if practical
- login smoke test for all roles

## 2. Admin Dashboard

Route:

```text
/admin/dashboard
```

Purpose:

- Admin control center landing page.
- Quick access to pending final actions, archive, audit, reports, organization setup.

Problems to check:

- placeholder cards
- weak information hierarchy
- unclear admin priorities
- no strong control center feel

Must not change:

- admin API logic
- workflow finalization logic

## 3. Champ Branch Detail

Route:

```text
/champ/branches/:vendorId
```

Purpose:

- Core branch-first operations screen.
- Starting point for New Hire, Transfer, Resignation, Termination.

Problems to check:

- actions placement
- picker list clarity
- branch context visibility
- request history visibility
- confusing tabs/sections

Must not change:

- scope validation
- workflow creation endpoints
- picker list source

## 4. Request Detail

Route:

```text
/requests/:id
```

Purpose:

- Central workflow inspection and action page.

Target layout:

```text
Top: request title/type/status
Main: request data and entity context
Side panel: current required action
Bottom: approvals + timeline + audit/history
```

Problems to check:

- final action placement
- poor timeline clarity
- unclear source/destination context
- workflow result summary missing or weak

Must not change:

- approve/reject behavior
- finalization behavior
- request status machine

## 5. New Hire Form

Route:

```text
/champ/branches/:vendorId/new-hire
```

Purpose:

- Branch-first candidate request.

Recommended style:

- wizard or structured single page
- candidate info
- selected Branch summary
- approval path preview
- final review

Must not change:

- source Branch derivation
- required Shopper ID finalization
- temporary password rules

## 6. Transfer Form

Route:

```text
/champ/branches/:vendorId/transfer
```

Purpose:

- Move Picker from source Branch to destination Branch.

Recommended style:

- source context
- picker selection
- destination selection
- approval path preview
- final review

Must not change:

- same-chain vs cross-chain rules
- assignment closure/creation logic

## 7. Offboarding Forms

Routes:

```text
/champ/branches/:vendorId/resignation
/champ/branches/:vendorId/termination
```

Purpose:

- Resignation/Termination request submission.

Recommended style:

- selected Branch
- selected Picker
- reason/date/notes
- risk/warning copy
- review section

Must not change:

- admin finalization requirement
- block status behavior
- archive/deactivation behavior

## 8. Area Manager Dashboard

Route:

```text
/area-manager/dashboard
```

Purpose:

- Chain-scoped visibility and approvals entry point.

Target sections:

- assigned Chains
- pending approvals
- requests in scope
- workforce map
- reports link

Must not change:

- scope rules
- approval ownership

## 9. Reports Pages

Routes:

```text
/admin/reports
/area-manager/reports
/champ/reports
```

Purpose:

- operational counts.

Problems to check:

- too many cards
- weak grouping
- unclear role scope
- tables not readable

Must not change:

- report queries
- scope restrictions

## 10. Picker Dashboard / Profile Completion

Routes:

```text
/picker/dashboard
/picker/profile-completion
```

Purpose:

- simple worker-facing workspace.

Target:

- profile status
- branch context
- manager context
- clear next steps

Must not change:

- forced password change
- profile completion validation
- safe fields

## Completion Rule

Do not move to the next page until the current page is visually accepted by the product owner.
