# Mobile API Contract

## Purpose

This is the first mobile API contract planning document for a future SuperNova mobile app inside the same monorepo.

The document is planning-only. It does not create `apps/mobile`, does not add a mobile framework, and does not implement backend routes. Its purpose is to define the smallest safe read-only mobile API surface before implementation work begins.

SuperNova remains a Talabat-style Partner Workforce Operations System built around:

```text
Assignments + Requests + Approvals + Role-based Workspaces
```

## Current repo facts

### Monorepo shape

The root `package.json`, `README.md`, and `docs/REPO_INDEX.md` show the current npm workspace shape:

```text
apps/web
apps/api
packages/shared
```

The root scripts include local dev commands for the API, worker, and web app, workspace build/lint/typecheck commands, and root Prisma commands. A future mobile app should stay inside this monorepo unless a separate product decision changes that direction.

### Current API prefix

`apps/api/src/main.ts` sets the global NestJS API prefix to:

```text
/api
```

The same file enables cookie parsing, CORS with credentials, and a configured web origin. `README.md` lists the local API base as `http://localhost:4000` and the health endpoint as `http://localhost:4000/api/health`.

### Current web auth behavior

The current web flow is cookie-first:

- `POST /api/auth/login` accepts `nationalId`, `password`, and optional `rememberMe`.
- Login returns `user`, `redirectTo`, and `mustChangePassword`.
- Login sets a configured HttpOnly auth cookie with `sameSite: "lax"`, `secure` in production, and `path: "/"`.
- `GET /api/auth/me` returns the current safe user and redirect metadata.
- `POST /api/auth/logout` clears the auth cookie.
- `POST /api/auth/change-password` updates password state and returns the same auth response shape.
- `apps/web/lib/api/request.ts` calls `${NEXT_PUBLIC_API_URL}/api${path}` and always sends `credentials: "include"`.
- `AuthProvider` refreshes the web session through `/auth/me` on mount and clears client-side API cache after login, logout, and password change.

The server-side `JwtAuthGuard` reads the configured auth cookie first, then falls back to an `Authorization: Bearer <token>` header. That fallback exists, but the current web login contract does not expose a mobile token contract.

### Existing role workspace endpoints

`apps/api/src/workspaces/workspaces.controller.ts` currently exposes these role-scoped workspace endpoints under `/api/workspaces`:

| Endpoint | Roles |
| --- | --- |
| `GET /api/workspaces/picker` | `PICKER` |
| `GET /api/workspaces/picker/performance-summary` | `PICKER` |
| `GET /api/workspaces/champ` | `CHAMP` |
| `GET /api/workspaces/champ/performance-summary` | `CHAMP` |
| `GET /api/workspaces/champ/branches` | `CHAMP` |
| `GET /api/workspaces/champ/branches/:vendorId` | `CHAMP` |
| `GET /api/workspaces/area-manager` | `AREA_MANAGER` |
| `GET /api/workspaces/area-manager/performance-summary` | `AREA_MANAGER` |
| `GET /api/workspaces/admin` | `ADMIN`, `SUPER_ADMIN` |
| `GET /api/workspaces/admin/performance-summary` | `ADMIN`, `SUPER_ADMIN` |

These routes use `JwtAuthGuard` and `RolesGuard`. The service layer uses operational assignment tables, not hierarchy fields on `User`, to build scoped workspace responses.

### Current shared package status

`packages/shared` currently exports a small set of constants:

- `APP_NAME`
- `CORE_DOMAIN_NOTE`
- `WORKFLOW_GUARDRAIL`
- `ROLE_REDIRECTS`

It is not currently a shared API contract package, generated client package, or shared DTO package.

## Mobile product principle

The mobile app should be operational, role-scoped, and intentionally small in Phase 1.

It should not become a generic HR app. It should not add payroll, GPS, biometric attendance, POS, inventory, accounting, live tracking, order integration, microservices, or generic ERP behavior.

Phase 1 should start read-only where possible:

- Show who the user is.
- Show the correct role workspace.
- Show notifications.
- Show visible requests.
- Show pending approvals as read-only queue items.

Sensitive lifecycle changes must remain:

```text
Request -> Approval -> System applies change
```

The mobile app must not bypass `PickerBranchAssignment`, `VendorChampAssignment`, or `ChainAreaManagerAssignment` as the operational source of truth.

## Mobile auth decision needed

The current web auth flow is built around an HttpOnly cookie and `credentials: "include"`. That works for the browser app because the API CORS origin is the configured web origin and the browser handles cookie transport.

A mobile app needs an explicit auth decision because native mobile clients do not behave like the current browser app:

- Cookie storage and forwarding differ by framework and platform.
- `sameSite: "lax"` and web-origin CORS assumptions are browser-centered.
- Secure token storage, refresh behavior, logout, device audit, and revocation need an explicit contract.
- The backend guard can already read Bearer tokens, but login does not currently return a mobile token response.

### Option A: Reuse cookie auth carefully

Description: Keep using the existing login endpoint and configure the mobile client to preserve and resend the HttpOnly auth cookie.

Benefits:

- Smallest backend change if the mobile framework can reliably handle cookies.
- Reuses current login, logout, `/auth/me`, temporary password, account access, and audit behavior.
- Keeps token material out of JavaScript-accessible app state when the platform cookie jar is correctly configured.

Risks and open questions:

- Requires a clear mobile cookie policy per platform.
- Requires review of CORS, `sameSite`, secure transport, and development URLs.
- Can be fragile if the mobile framework does not consistently persist cookies.
- Does not define mobile device session tracking or revocation beyond the current web session behavior.

### Option B: Add mobile-specific auth behavior/token handling

Description: Add an explicit mobile auth contract inside the existing API, likely using Bearer tokens with secure OS storage and clear session lifecycle rules.

Benefits:

- Matches the `JwtAuthGuard` Bearer-token fallback already present in the API.
- Makes token lifetime, refresh, logout, device identity, and revocation explicit.
- Avoids relying on browser-only cookie behavior for a native app.
- Gives the backend a clean place to audit mobile session events.

Risks and open questions:

- Requires careful design before implementation.
- Must not leak tokens into logs, notifications, local storage, screenshots, or error reports.
- Needs a decision on refresh tokens, token rotation, device binding, and forced logout.
- Must stay inside the existing modular monolith.

Recommended direction: choose Option B as the safer long-term direction, but only after a dedicated mobile auth technical decision document. Do not implement mobile auth as part of this contract document.

## Proposed Phase 1 mobile endpoints

These are read-only candidate endpoints. They do not exist yet.

All paths are proposed under the existing `/api` prefix:

```text
/api/mobile/*
```

### Common response rules

- Responses should be compact and mobile-friendly.
- Do not expose `passwordHash`, raw national ID, temporary passwords, JWT secrets, raw internal payloads, or unnecessary assignment record IDs.
- Use stable IDs only when the mobile client needs navigation or later read access.
- Prefer display names, role labels, counts, status, and hrefs over full web dashboard payloads.
- Error responses should use a consistent mobile envelope.

Common error shape draft:

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication is required.",
    "details": []
  }
}
```

### `GET /api/mobile/me`

Purpose: Return the current authenticated user in a compact mobile shape.

Allowed roles: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN`.

Scope behavior:

- Uses the authenticated user only.
- Does not expose hierarchy from `User`.
- Does not include raw national ID, password state internals, or audit fields.
- Can include `mustChangePassword` so the app can route the user safely.

Response shape draft:

```json
{
  "user": {
    "id": "usr_picker_001",
    "role": "PICKER",
    "displayName": "Ahmed Hassan",
    "phoneNumber": "+201000000000",
    "nationalIdMasked": "**********1234",
    "accountStatus": "ACTIVE",
    "employmentStatus": "ACTIVE",
    "profileStatus": "COMPLETE",
    "mustChangePassword": false
  },
  "workspace": {
    "kind": "PICKER",
    "href": "/api/mobile/workspace"
  },
  "requiresAction": []
}
```

Error shape draft:

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication is required.",
    "details": []
  }
}
```

Notes / open questions:

- Depends on the mobile auth decision.
- Should reuse the current account access checks in `JwtAuthGuard`.
- Must decide whether `nationalIdMasked` is useful enough for mobile Phase 1.

### `GET /api/mobile/workspace`

Purpose: Return a single compact workspace response based on the authenticated user's role.

Allowed roles: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN`.

Scope behavior:

- The API chooses the workspace from `user.role`.
- `PICKER` scope comes from the active `PickerBranchAssignment`.
- `CHAMP` scope comes from active `VendorChampAssignment` rows.
- `AREA_MANAGER` scope comes from active `ChainAreaManagerAssignment` rows.
- `ADMIN` and `SUPER_ADMIN` can receive global operational summaries, still without write actions in Phase 1.

Response shape draft:

```json
{
  "role": "CHAMP",
  "title": "Champ workspace",
  "summary": [
    { "key": "branches", "label": "Branches", "value": 3 },
    { "key": "activePickers", "label": "Active pickers", "value": 42 },
    { "key": "pendingRequests", "label": "Pending requests", "value": 5 }
  ],
  "scope": {
    "branches": [
      {
        "id": "vendor_001",
        "name": "Maadi Branch",
        "chainName": "Tmart"
      }
    ]
  },
  "actions": []
}
```

Error shape draft:

```json
{
  "error": {
    "code": "ROLE_NOT_SUPPORTED",
    "message": "No mobile workspace is available for this role.",
    "details": []
  }
}
```

Notes / open questions:

- This endpoint should wrap or adapt existing role workspace services rather than duplicate scope logic.
- The mobile response should not mirror the full web workspace response.
- Decide whether performance summaries belong in Phase 1 or remain web-only until a later mobile phase.

### `GET /api/mobile/notifications`

Purpose: Return current-user notification summaries for a mobile inbox.

Allowed roles: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` with `notifications.view`.

Scope behavior:

- Only returns notifications where `notification.userId` is the authenticated user.
- Supports pagination and an unread-only filter.
- Does not include write actions such as mark-read or read-all in Phase 1.

Response shape draft:

```json
{
  "items": [
    {
      "id": "ntf_001",
      "type": "APPROVAL_PENDING",
      "title": "Approval pending",
      "body": "Annual Leave request requires your approval.",
      "read": false,
      "createdAt": "2026-06-24T10:30:00.000Z",
      "target": {
        "kind": "request",
        "id": "req_001"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "unreadCount": 1
  }
}
```

Error shape draft:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to view notifications.",
    "details": []
  }
}
```

Notes / open questions:

- Current backend notification list already scopes by authenticated user.
- Mobile should avoid exposing arbitrary raw `payload`; map it to a small `target` object.
- Mark-read can be a later write phase, not Phase 1.

### `GET /api/mobile/requests`

Purpose: Return request summaries visible to the authenticated user.

Allowed roles: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` with `requests.view`.

Scope behavior:

- Uses current request visibility principles: creator, target user where allowed, assigned approval ownership, operational assignment scope, or admin scope.
- `CHAMP` operational scope must derive from active `VendorChampAssignment`.
- `AREA_MANAGER` operational scope must derive from active `ChainAreaManagerAssignment`.
- `ADMIN` and `SUPER_ADMIN` can see broader request queues according to existing permissions.
- Does not expose write endpoints for submit, cancel, new hire, transfer, resignation, annual leave, approval, or rejection.

Response shape draft:

```json
{
  "items": [
    {
      "id": "req_001",
      "type": "ANNUAL_LEAVE",
      "status": "PENDING_CHAMP",
      "title": "Annual Leave",
      "subtitle": "Ahmed Hassan",
      "createdAt": "2026-06-24T09:00:00.000Z",
      "currentStep": "CHAMP_APPROVAL",
      "target": {
        "userId": "usr_picker_001",
        "displayName": "Ahmed Hassan"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

Error shape draft:

```json
{
  "error": {
    "code": "REQUEST_SCOPE_DENIED",
    "message": "You do not have access to these requests.",
    "details": []
  }
}
```

Notes / open questions:

- Decide whether Phase 1 should expose only `my/submitted`, all visible requests, or both through filters.
- Keep request detail read-only if added later.
- Do not add lifecycle write actions to mobile Phase 1.
- Do not expand deduction, payroll, or attendance penalty behavior through this endpoint.

### `GET /api/mobile/approvals`

Purpose: Return pending approvals visible to the authenticated user as read-only queue cards.

Allowed roles: `PICKER`, `CHAMP`, `AREA_MANAGER`, `ADMIN`, `SUPER_ADMIN` with `approvals.pending.view`.

Scope behavior:

- Returns only pending approval steps that are current for their request.
- Must validate approval ownership, role authority, permission, and assignment scope.
- `CHAMP` decisions must remain branch-scope aware.
- `AREA_MANAGER` decisions must remain chain-scope aware.
- `ADMIN` and `SUPER_ADMIN` final lifecycle approvals must remain permission-gated.
- No approve or reject action is included in Phase 1.

Response shape draft:

```json
{
  "items": [
    {
      "approvalId": "apv_001",
      "requestId": "req_001",
      "requestType": "ANNUAL_LEAVE",
      "step": "CHAMP_APPROVAL",
      "status": "PENDING",
      "title": "Annual Leave approval",
      "targetName": "Ahmed Hassan",
      "createdAt": "2026-06-24T09:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1
  },
  "actions": []
}
```

Error shape draft:

```json
{
  "error": {
    "code": "APPROVAL_SCOPE_DENIED",
    "message": "You do not own this approval step.",
    "details": []
  }
}
```

Notes / open questions:

- Current approval decisions can trigger sensitive system changes. Phase 1 should display the queue only.
- A later write phase must separately document approve, reject, finalization, request state validation, and audit logging.
- The mobile app must not shortcut the web request detail requirements for sensitive final actions.

## Role-specific workspace response drafts

These drafts are compact examples for `GET /api/mobile/workspace`. They are not current implemented responses.

### `PICKER`

```json
{
  "role": "PICKER",
  "title": "Picker workspace",
  "profile": {
    "displayName": "Ahmed Hassan",
    "profileStatus": "COMPLETE",
    "mustChangePassword": false
  },
  "assignment": {
    "branch": {
      "id": "vendor_001",
      "name": "Maadi Branch"
    },
    "chain": {
      "id": "chain_001",
      "name": "Tmart"
    },
    "champ": {
      "id": "usr_champ_001",
      "displayName": "Sara Ali"
    },
    "areaManager": {
      "id": "usr_area_001",
      "displayName": "Mona Samir"
    }
  },
  "summary": [
    { "key": "openRequests", "label": "Open requests", "value": 2 },
    { "key": "unreadNotifications", "label": "Unread", "value": 3 }
  ],
  "actions": []
}
```

### `CHAMP`

```json
{
  "role": "CHAMP",
  "title": "Champ workspace",
  "summary": [
    { "key": "branches", "label": "Branches", "value": 3 },
    { "key": "activePickers", "label": "Active pickers", "value": 42 },
    { "key": "pendingRequests", "label": "Pending requests", "value": 5 }
  ],
  "scope": {
    "branches": [
      {
        "id": "vendor_001",
        "name": "Maadi Branch",
        "chainName": "Tmart",
        "activePickers": 18,
        "pendingRequests": 2
      }
    ]
  },
  "actions": []
}
```

### `AREA_MANAGER`

```json
{
  "role": "AREA_MANAGER",
  "title": "Area Manager workspace",
  "summary": [
    { "key": "chains", "label": "Chains", "value": 2 },
    { "key": "branches", "label": "Branches", "value": 12 },
    { "key": "activePickers", "label": "Active pickers", "value": 176 },
    { "key": "activeChamps", "label": "Active champs", "value": 9 }
  ],
  "scope": {
    "chains": [
      {
        "id": "chain_001",
        "name": "Tmart",
        "branches": 8,
        "activePickers": 120,
        "activeChamps": 6
      }
    ]
  },
  "actions": []
}
```

### `ADMIN` / `SUPER_ADMIN`

```json
{
  "role": "ADMIN",
  "title": "Admin workspace",
  "summary": [
    { "key": "chains", "label": "Chains", "value": 5 },
    { "key": "branches", "label": "Branches", "value": 48 },
    { "key": "activeUsers", "label": "Active users", "value": 640 },
    { "key": "pendingAdminActions", "label": "Pending admin actions", "value": 7 }
  ],
  "queues": [
    {
      "key": "pendingApprovals",
      "label": "Pending approvals",
      "count": 7,
      "href": "/api/mobile/approvals"
    }
  ],
  "actions": []
}
```

## Access-control rules

Every mobile endpoint must enforce:

- Authentication
- Role perimeter
- Permission check where applicable
- Assignment scope validation
- Request/entity state validation
- Audit logging for sensitive actions

Frontend hiding is not security. Mobile screens should never be treated as the enforcement layer.

Even read-only endpoints must avoid leaking cross-role or cross-assignment data. Any future write endpoint must document the request state machine, approval ownership, operational scope rule, and audit event before implementation.

## Explicit out of scope

For this phase, these are out of scope:

- Building the mobile app
- Adding Expo, React Native, or Flutter
- Adding write actions
- Approval or rejection actions
- New Hire submission
- Transfer or resignation actions
- Prisma changes
- New backend implementation
- Production API documentation generation

Also out of scope:

- Payroll
- GPS
- Biometric attendance
- POS
- Inventory
- Accounting
- Live tracking
- Order integration
- Microservices
- Generic ERP behavior

## Next recommended phase

Next smallest phase: create a Mobile Auth Technical Decision document.

That document should decide whether mobile uses carefully managed cookie auth or a mobile-specific Bearer-token/session contract. The recommendation here is to design a mobile-specific auth contract inside the existing API, using the current modular monolith and the existing guard behavior as the starting point.

Do not implement the next phase from this document alone.
