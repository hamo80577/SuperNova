# 05 — Security and Privacy Rules

## Backend Security Principle

Frontend hiding is not security.

Every protected backend mutation must validate:

```text
Authentication
Role
Operational scope
Entity state
Request state
Approval ownership
Audit logging
```

## Auth Rules

Blocked or inactive users must not access normal app flows.

Rules:

```text
Inactive accounts cannot login.
Archived accounts cannot login.
Permanently blocked accounts cannot login.
Temporarily blocked accounts cannot login while block is active.
Temporary password users must change password before normal access.
Picker profile completion happens after password change.
```

## Sensitive Data

Never expose:

```text
passwordHash
raw password
raw temporary password in notifications
JWT secret
tokens
cookies
credentials
```

## Temporary Password Policy

Temporary password must be:

```text
Generated server-side
Hashed into passwordHash
Encrypted only if needed for controlled reveal
Never sent in notifications
Visible only through authorized profile credential panel
Audited on reveal
Audited on reset
Invalidated after password change
```

## Candidate Lookup Privacy

Candidate lookup must be role-protected and scope-aware.

Allowed:

```text
Champ -> assigned Branch scope only
Area Manager -> assigned Chain scope only
Admin/Super Admin -> full operational scope
```

Do not expose full sensitive identity data.

Allowed lookup response:

```text
maskedNationalId
role
accountStatus
employmentStatus
blockStatus
blockedUntil
blockReason if operationally needed
lastBranch if available
rehire eligibility decision
```

Avoid exposing:

```text
full national ID
full address
password fields
private credentials
```

## Block Policy

Temporary block:

```text
Cannot rehire until blockedUntil has passed.
Show remaining time and reason.
```

Permanent block:

```text
Cannot rehire.
Admin must remove block from user profile first.
```

## Secrets Policy

Do not commit:

```text
.env
.env.local
real API keys
SMTP credentials
JWT secrets
database URLs with real credentials
```

## Security Review Required For

```text
Auth changes
Role guard changes
Scope validation changes
Credential reveal/reset
Notification payload changes
Request payload changes
User profile response changes
Admin controls
Exports/downloads
```
