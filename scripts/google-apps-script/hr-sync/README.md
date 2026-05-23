# SuperNova HR Google Sheets Sync Apps Script

This package contains the Google Apps Script Web App handler for SuperNova HR Sync.

It receives backend POST requests, validates a shared secret, ensures the required Google Sheet tabs exist, and appends one row for supported Picker lifecycle events:

- `NEW_HIRE`
- `REHIRE`
- `RESIGN`

Google Sheets is not the source of truth. SuperNova remains authoritative for workflow state.

## Setup

1. Create or open the target Google Sheet.
2. Create a Google Apps Script project for that Sheet or as a standalone project.
3. Paste the contents of `Code.gs` into the Apps Script editor.
4. Run setup from the Apps Script editor:

   ```javascript
   setupHrSync(
     "paste-google-sheet-url-or-spreadsheet-id-here",
     "replace-with-your-32-character-minimum-secret"
   );
   ```

5. Authorize the script when prompted.
6. Deploy the script as a Web App.
7. Copy the Web App deployment URL.
8. Configure backend environment values:

   ```text
   HR_SYNC_ENABLED=true
   HR_SYNC_WEB_APP_URL=<deployment-url>
   HR_SYNC_SECRET=<same-secret>
   ```

9. Restart the API.

Do not put the Web App URL or shared secret in frontend environment variables.

## Deployment Settings

Recommended Web App settings:

- Execute as: `Me`
- Who has access: `Anyone with the link`, or the closest equivalent available in the Google account/workspace.

The shared secret is still required for writes. Requests without the correct secret are rejected.

## Script Properties

The setup function stores these script properties:

- `SPREADSHEET_ID`
- `HR_SYNC_SECRET`

Run `doGet` through the deployed Web App URL to check whether the script is configured. The health response does not expose the secret or spreadsheet ID.

## Sheet Tabs And Headers

The script manages two tabs.

### New Hire

Headers:

- `Email Address`
- `Request Type`
- `New Hire Full Name (English)`
- `New Hire National ID`
- `New Hire Phone Number`
- `New Hire Actual Joining/Hiring Date`
- `New Hire Home Address`
- `Vertical`
- `New Hire Title`

### Resign

Headers:

- `Email Address`
- `Request Type`
- `Type`
- `Resigned Employee Name`
- `Resigned Employee National ID`
- `Resigned Employee Last Working Date (LWD)`
- `Resigned Employee Title`

If a tab is missing, the script creates it. If the first row is empty, the script writes headers. If headers already exist but do not exactly match the expected headers, the script returns an error and does not overwrite them.

## Testing With Sample Payloads

Use the included sample payload files:

- `sample-new-hire.payload.json`
- `sample-rehire.payload.json`
- `sample-resign.payload.json`

Replace the sample `secret` value with the same secret passed to `setupHrSync(...)`.

Example:

```powershell
$body = Get-Content -Raw .\sample-new-hire.payload.json
Invoke-RestMethod -Method Post -Uri "<web-app-url>" -ContentType "application/json" -Body $body
```

Expected success response:

```json
{
  "ok": true,
  "syncId": "hrsync-...",
  "sheet": "New Hire",
  "rowNumber": 2,
  "message": "Row appended successfully"
}
```

Backend end-to-end verification is planned for HR-7.

## Troubleshooting

- `Invalid secret.`: The request secret does not match `HR_SYNC_SECRET`.
- `Missing Script Property`: Run `setupHrSync(...)` again with a valid Sheet URL/ID and secret.
- Sheet access denied: Make sure the script owner can open the target spreadsheet.
- Header mismatch: Fix the first row to exactly match the expected headers or use a clean tab.
- `Bad JSON.`: The request body is not valid JSON.
- `Unsupported eventType.`: Use only `NEW_HIRE`, `REHIRE`, or `RESIGN`.
- Backend says `FAILED`: Check the backend HR Sync log and the Apps Script JSON error.
- Backend says `SKIPPED`: `HR_SYNC_ENABLED` is disabled in backend configuration.

## Security Notes

- Keep the shared secret private.
- Do not paste the secret in frontend code, UI, screenshots, or client-side env files.
- Rotate the secret if it is exposed.
- Do not hardcode real deployment URLs or real Sheet URLs in source control.
- Do not log or return the secret from Apps Script.
- Google Sheets failure must not be used to manually change SuperNova workflow state.
- Apps Script is an integration target only, not a source of truth.
