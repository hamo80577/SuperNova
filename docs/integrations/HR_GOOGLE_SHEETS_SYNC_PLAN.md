# HR Google Sheets Sync Plan

## Executive Summary

This document plans a future HR Sync integration from SuperNova to Google Sheets through a Google Apps Script Web App.

HR-0 was documentation only. HR-1 added backend foundation only: `HrSyncLog` schema tracking, backend env validation placeholders, typed payload helpers, and an inert `HrSyncService` skeleton.

No workflow finalization hook, Apps Script package, external call, or UI exists yet.

The integration is planned after Picker lifecycle workflows and before any broad UI/UX work resumes. SuperNova remains a Partner Workforce Operations System, not a generic HR ERP.

## Product Scope

Included:

- Picker New Hire.
- Picker Rehire.
- Picker Resignation.
- Post-finalization sync to HR-owned Google Sheets.
- Backend-to-Google Apps Script POST integration.
- Future ticket/request detail HR Sync status indicator.

Excluded:

- Champ New Hire/Rehire/Resignation sync.
- Area Manager New Hire/Resignation sync.
- Payroll.
- Attendance.
- GPS.
- Order integration.
- Inventory.
- Accounting.
- Generic ERP/HR ERP behavior.
- Google Sheets as a system source of truth.

## Core Rules

- HR Sync is post-finalization only.
- HR Sync runs after the workflow is successfully finalized and SuperNova has applied the lifecycle change.
- HR Sync must not be the source of truth.
- Google Sheets must not drive SuperNova state.
- If Google Sheets sync fails, workflow finalization must remain complete.
- Failed sync should be logged and shown later as retryable.
- Do not roll back Picker creation, rehire, resignation, assignment closure, or account status changes because Google Sheets failed.
- HR Sync is Picker-only unless a later scoped product decision expands it.

## Integration Method

The planned flow:

1. SuperNova backend finalizes a supported Picker lifecycle workflow.
2. SuperNova creates an HR Sync log row with the payload snapshot and initial status.
3. SuperNova sends a POST request to a Google Apps Script Web App deployment URL.
4. Apps Script validates a shared secret.
5. Apps Script ensures required Google Sheet tabs and headers exist.
6. Apps Script appends one row to the correct tab.
7. Apps Script responds with JSON success or failure.
8. SuperNova updates the HR Sync log with response or error details.

Target Google Sheet tabs:

- `New Hire`
- `Resign`

Apps Script must create a tab if it is missing. Apps Script must write headers if they are missing.

## Backend Configuration

The Google Apps Script Web App URL must not be hardcoded.

Planned backend-only environment variables:

```text
HR_SYNC_ENABLED=true|false
HR_SYNC_WEB_APP_URL=https://script.google.com/macros/s/.../exec
HR_SYNC_SECRET=<long random secret>
```

Rules:

- Store these only in backend environment configuration, for example `apps/api/.env`.
- Do not put them in frontend environment variables.
- Do not expose the URL or secret in UI.
- Do not commit real values.
- Do not log the secret.
- Redact the deployment URL from user-facing error messages.

These environment variables are backend-only. HR-1 added placeholder validation and example entries, but no workflow code calls Google Apps Script yet.

## Recommended Data Model Direction

Prefer a dedicated `HrSyncLog` model/table instead of adding many HR sync columns directly to `Request`.

Planned fields:

| Field | Purpose |
| --- | --- |
| `id` | Primary identifier. |
| `requestId` | Associated SuperNova request. |
| `workflowType` | Lifecycle workflow type, such as `NEW_HIRE`, `REHIRE`, or `RESIGN`. |
| `targetSheet` | Google Sheet tab name, such as `New Hire` or `Resign`. |
| `status` | `NOT_SENT`, `SENT`, `FAILED`, or `SKIPPED`. |
| `payloadSnapshot` | JSON payload sent or prepared for Apps Script. |
| `responseSnapshot` | JSON response from Apps Script when available. |
| `errorMessage` | Safe failure message for diagnostics and retry. |
| `sentAt` | Timestamp for successful send. |
| `createdAt` | Log creation timestamp. |
| `updatedAt` | Log update timestamp. |

Implemented in HR-1 as a dedicated Prisma `HrSyncLog` model/table with enum-backed workflow type, target sheet, and status fields.

## Status and UI Direction

Future ticket/request detail and timeline UI should show:

- `Sent to HR` with a check mark when sync succeeds.
- `HR Sync failed` when sync fails.
- `Skipped` when the request is not applicable.

The indicator belongs in ticket detail/timeline UI. No UI is implemented in this phase.

## New Hire and Rehire Payload

Google Sheet tab: `New Hire`

Event types:

- `NEW_HIRE`
- `REHIRE`

Headers:

| Header | Mapping |
| --- | --- |
| `Email Address` | Temporarily use the admin/finalizer display name who finalized the request. |
| `Request Type` | `New Hire` for normal new hire, `Rehire` for rehire. |
| `New Hire Full Name (English)` | Picker English name. |
| `New Hire National ID` | Picker national ID. |
| `New Hire Phone Number` | Picker phone number. |
| `New Hire Actual Joining/Hiring Date` | `actualJoiningDate` request payload field captured for Picker New Hire/Rehire. |
| `New Hire Home Address` | Picker home address from request/profile data. |
| `Vertical` | Always `Local Shops`. |
| `New Hire Title` | Always `Picker`. |

### Actual Joining Date Status

HR-2 added an `actualJoiningDate` date picker to Picker New Hire/Rehire request submission.

Rules:

- Required for Picker New Hire/Rehire.
- Stored in the request payload.
- Used as the official system reference for the Picker start date.
- Separate from request creation date.
- Not required for Champ or Area Manager in this HR Sync scope.
- Google Apps Script sync remains intentionally deferred.

## Resignation Payload

Google Sheet tab: `Resign`

Event type:

- `RESIGN`

Headers:

| Header | Mapping |
| --- | --- |
| `Email Address` | Temporarily use the admin/finalizer display name who finalized the request. |
| `Request Type` | `Resign`. |
| `Type` | Request/block status semantics, for example `No Block`, `Temporary Block`, or `Permanent Block`. |
| `Resigned Employee Name` | Picker English name. |
| `Resigned Employee National ID` | Picker national ID. |
| `Resigned Employee Last Working Date (LWD)` | `lastWorkingDate` field captured for Picker resignation request data. |
| `Resigned Employee Title` | Always `Picker`. |

### Last Working Date Status

HR-2 added `lastWorkingDate` to Picker resignation request submission.

Rules:

- It represents the Picker's last working date for HR reporting.
- It must be part of Picker resignation request data.
- It must not be inferred from finalization date unless a later product decision explicitly allows that fallback.
- Google Apps Script sync remains intentionally deferred.

## Apps Script Package Plan

Future package location:

```text
scripts/google-apps-script/hr-sync/Code.gs
scripts/google-apps-script/hr-sync/README.md
scripts/google-apps-script/hr-sync/samples/new-hire.json
scripts/google-apps-script/hr-sync/samples/rehire.json
scripts/google-apps-script/hr-sync/samples/resign.json
```

Apps Script responsibilities:

- Receive POST JSON.
- Validate shared secret.
- Validate event type:
  - `NEW_HIRE`
  - `REHIRE`
  - `RESIGN`
- Open target spreadsheet from Script Properties.
- Ensure `New Hire` and `Resign` sheets exist.
- Ensure headers exist.
- Append one row.
- Return JSON:
  - `ok`
  - `sheet`
  - `rowNumber`
  - `syncId`
  - `message`

Apps Script should keep deployment URL and spreadsheet ID out of committed source where possible. Use Script Properties for deployment-specific settings.

## Backend Service Direction

Backend implementation should keep HR Sync behind a small focused service boundary, `HrSyncService`.

HR-1 added the initial `HrSyncService` skeleton. It can build typed payloads and create/update sync log rows, but it does not call external HTTP and is not wired into finalization workflows.

Current HR-1 responsibilities:

- Check `HR_SYNC_ENABLED`.
- Build event-specific payloads.
- Create/update `HrSyncLog`.
- Mark `SENT`, `FAILED`, or `SKIPPED`.

Future responsibilities after Apps Script integration:

- POST to Apps Script with a shared secret.
- Never throw in a way that rolls back completed lifecycle finalization after the system state has been applied.
- Provide a clear retryable failure state for future admin visibility.

The service should not own lifecycle rules. New Hire and Resignation workflow services remain authoritative for finalization.

## Failure Semantics

If HR Sync fails after finalization:

- Keep the SuperNova workflow completed.
- Keep created/reactivated Picker and assignment changes.
- Keep resigned Picker account/assignment changes.
- Write failure details to `HrSyncLog`.
- Show `HR Sync failed` later in request/ticket detail.
- Make retry possible in a later phase.

If HR Sync is disabled:

- Mark applicable requests as `SKIPPED` or avoid creating a send attempt, depending on final data model decision.
- Do not treat disabled sync as a workflow failure.

## Security Rules

- Use shared-secret validation between backend and Apps Script.
- Do not expose the Apps Script URL or secret in frontend.
- Do not commit real secrets.
- Do not log the shared secret.
- Treat manual changes to the Google Sheet as outside SuperNova source-of-truth guarantees.
- Payload snapshots should avoid secrets and credentials.
- Do not include raw temporary passwords.
- Do not send password hashes, tokens, cookies, JWT secrets, or database URLs.

## Planned Implementation Phases

1. `HR-0`: Documentation cleanup and integration plan. Implemented.
2. `HR-1`: Backend HR Sync foundation: env placeholders, `HrSyncLog` schema/migration, typed payload helpers, and inert `HrSyncService`. Implemented.
3. `HR-2`: Picker New Hire/Rehire `actualJoiningDate` and Picker Resignation `lastWorkingDate` request payload/form fields. Implemented.
4. `HR-3`: Google Apps Script package with sample payloads. Deferred until the backend contract is stable.
5. `HR-4`: Backend Apps Script client wiring inside `HrSyncService`, still not called by workflows until finalization hooks.
6. `HR-5`: Finalization hooks for Picker New Hire/Rehire and Picker Resign only.
7. `HR-6`: Ticket details/timeline HR Sync status indicator.
8. `HR-7`: Retry/admin visibility and regression.

## Acceptance Criteria for Future Work

Future implementation is acceptable only when:

- HR Sync applies only to Picker New Hire/Rehire and Picker Resignation.
- Workflow finalization succeeds independently of Google Sheets availability.
- Google Sheets does not drive SuperNova state.
- Apps Script validates a shared secret.
- The deployment URL and secret are backend-only env values.
- `HrSyncLog` or equivalent tracking exists before UI status is added.
- Ticket detail/timeline status accurately reflects sent, failed, skipped, and retryable states.
- No payroll, attendance, GPS, order, inventory, accounting, or generic ERP behavior is added.

## Documentation Cleanup Note

See `docs/DOCS_CLEANUP_REPORT.md` for the cleanup decision made during `HR-0`.
