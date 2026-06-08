---
name: supernova-refactor-debug-review
description: Use this skill for SuperNova refactoring, debugging, code smell audits, hardcoded-value audits, dead-code review, PR/diff review, and quality gate checks before merge.
---

# SuperNova Refactor Debug Review

## Purpose

Safely improve code quality without hiding bugs or preserving bad design blindly.

Use this skill for:
- refactor planning
- splitting large files
- debugging
- hardcoded value audits
- workaround detection
- dead-code review
- duplicate logic review
- diff review
- pre-merge quality checks

## Refactor Mindset

Refactor should improve structure without accidental behavior change.

But do not blindly organize bad code.

If existing behavior is suspicious:
- report it
- explain risk
- propose options
- recommend a fix path
- do not implement behavior changes without approval

## Refactor Rules

Prefer:
- read-only audit first
- responsibility map
- smallest safe slice
- one responsibility moved at a time
- stable public API/facade when possible
- checks after each slice

Avoid:
- big-bang refactor
- moving files for aesthetics only
- changing behavior during cleanup
- deleting tests
- weakening types
- adding `as any`
- hiding errors
- broad unrelated import churn

## Debugging Method

For bugs:
1. Reproduce or identify the failing path.
2. Localize the cause.
3. Explain root cause.
4. Propose the smallest fix.
5. Add or identify test coverage.
6. Run checks.
7. Report remaining risk.

Do not "fix" by:
- swallowing errors
- adding blind fallback behavior
- disabling lint/type errors
- hardcoding one user/branch/status case
- moving the problem to the frontend

## Code Smell Audit

Look for:
- hardcoded roles/statuses/IDs/routes/URLs
- `TODO`, `FIXME`, `HACK`, `TEMP`, `workaround`
- `eslint-disable`
- `@ts-ignore`
- `@ts-expect-error`
- `as any`
- swallowed catch blocks
- `console.log`
- `debugger`
- duplicated helpers
- direct Prisma mutations in controllers
- direct workflow/assignment mutations outside approved paths
- frontend-only authorization
- missing audit logs

## Review Gate

When reviewing a diff:
- inspect git status
- inspect git diff
- compare with requested scope
- identify unrelated changes
- identify behavior changes
- verify checks actually ran
- flag hardcoded fixes
- flag workflow/access-control regressions
- flag UI mobile risks if frontend changed

## Final Review Format

For review tasks, use:

Verdict:
Can move forward: Yes/No

Completed:
Missing:
Risks:
Required fixes:
Files reviewed:
Checks verified:
Manual verification required:
Next recommendation:
Codex prompt for fixes:

## Final Implementation Format

For implementation tasks, use:

- Summary
- Refactor/Fix Slice
- Files Changed
- Behavior Changes
- Tests/Checks Run
- Manual Verification
- Known Risks
- Completion Status
- Next Recommendation
