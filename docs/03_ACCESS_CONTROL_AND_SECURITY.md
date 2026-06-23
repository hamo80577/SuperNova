# Access Control And Security

## Backend Enforcement

Frontend hiding is not security.

Every protected backend read or mutation must enforce the relevant combination of:

```text
Authentication
Role perimeter
Permission checks
Operational scope validation
Entity state validation
Request state validation
Approval ownership
Audit logging
```

## Role And Permission Model

`User.role` remains the primary persona and workspace boundary:

```text
PICKER
CHAMP
AREA_MANAGER
ADMIN
SUPER_ADMIN
```

`AccessRole` and `UserAccessRoleAssignment` add permissions. They do not:

- Convert a Picker into a Champ.
- Grant workspace identity.
- Create operational assignments.
- Widen assignment-table scope.
- Bypass workflow finalization.
- Bypass service-level target validation.

## Permission Checks

Static route permissions use the access-control layer where appropriate.

Dynamic workflow decisions must remain in services when the permission depends on:

- Target role.
- Source Branch or Chain.
- Destination Branch or Chain.
- Actor assignment scope.
- Request status.
- Approval step ownership.
- Entity state.

Permission checks are an outer gate. Workflow services remain authoritative for lifecycle safety.

## Operational Scope

Operational scope must come from:

```text
PickerBranchAssignment
VendorChampAssignment
ChainAreaManagerAssignment
```

Frontend filters, route params, query params, imported source labels, or display-only organization names must not widen backend scope.

## Sensitive Workflow Rules

No permission may directly bypass:

```text
Request -> Approval -> System applies change
```

Direct Picker creation, direct Picker transfer, direct Picker archive/deactivation, and direct active Picker assignment edits are forbidden unless an approved scoped rule explicitly defines the exception.

## Temporary Passwords

Temporary password rules:

- Generated server-side.
- Hashed into `passwordHash`.
- Encrypted only for controlled reveal where the implementation supports it.
- Never sent in notifications.
- Visible only through authorized credential controls.
- Audited on reveal.
- Audited on reset.
- Invalidated after password change.

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

## Candidate Lookup Privacy

Candidate lookup must be role-protected and scope-aware.

Allowed scope:

```text
Champ -> assigned Branch scope
Area Manager -> assigned Chain scope
Admin/Super Admin -> full operational scope
```

Responses should expose only the operational fields needed for eligibility and handoff. Avoid full national ID, password fields, credential internals, or unrelated private profile data.

## HR Sync Security

HR Sync must use backend-only configuration and shared-secret validation.

Rules:

- Do not hardcode Google Apps Script deployment URLs.
- Do not expose Apps Script URL or secret in frontend.
- Do not commit real `HR_SYNC_WEB_APP_URL` or `HR_SYNC_SECRET` values.
- Do not log shared secrets.
- Validate the shared secret in Apps Script before appending rows.
- Do not send temporary passwords, password hashes, JWT secrets, tokens, cookies, or database URLs.
- Treat Google Sheets as an external reporting destination, not source of truth.

## Secrets Policy

Never commit:

```text
.env
.env.local
real API keys
SMTP credentials
JWT secrets
database URLs with real credentials
database dumps or backups with personal data
```

Use committed example env files for sample values only.
