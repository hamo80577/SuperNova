# 07 — Verification and Testing

## Principle

Use the lightest verification tier that matches the change.

Never claim a check passed unless it actually ran.

## Tier 1 — Docs Only

Use when changing markdown, instructions, comments, or planning documents only.

Checks:

```powershell
git diff --check
git status
```

No app startup required.

## Tier 2 — UI Only

Use for visual frontend changes that do not change API contracts or backend behavior.

Checks:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
```

For structural page changes:

```powershell
npm run build --workspace @supernova/web
```

Manual:

```text
Mobile 360/390/430
Desktop
No horizontal overflow
Main action visible
```

## Tier 3 — Frontend Behavior

Use when touching:

```text
auth redirects
API client behavior
protected route behavior
forms that call APIs
navigation behavior
```

Checks:

```powershell
npm run typecheck --workspace @supernova/web
npm run lint --workspace @supernova/web
npm run build --workspace @supernova/web
```

Manual:

```text
Login smoke if auth touched
Affected form submit path
Affected route navigation
Error handling
```

## Tier 4 — Backend / Full Stack

Use when touching:

```text
apps/api
prisma
DTOs
API contracts
auth backend
request workflows
approval workflows
assignment logic
notifications
audit
reports backend
```

Checks:

```powershell
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
```

If migrations changed:

```powershell
npm run prisma:migrate
```

Manual:

```text
Affected endpoint smoke
Affected workflow smoke
Auth/scope negative cases
Audit/notification check if relevant
```

## Windows Prisma Lock Fix

If `prisma:generate` fails with EPERM DLL rename:

```powershell
Get-Process node
Stop-Process -Name node -Force
npm run prisma:generate
```

## Regression Checklist

For workflow changes, manually verify:

```text
Allowed role succeeds
Disallowed role gets 403
Out-of-scope entity gets 403
Invalid entity state gets 400
Duplicate pending request is blocked
Approval owner can approve
Wrong approver cannot approve
Rejection does not apply lifecycle change
Finalization applies expected change
Audit logs are created
Notifications contain no secrets
```

## Final Verification Statement

Every final response must include:

```text
Verification tier used
Commands run
Manual checks performed
Checks not run and why
Known risks
```
