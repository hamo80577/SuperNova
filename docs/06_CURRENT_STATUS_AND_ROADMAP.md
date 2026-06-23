# Current Status And Roadmap

## Current Status

Current mode: official product development and production hardening.

The foundation is mostly built. Work should focus on hardening, UX polish, access-control safety, testing, and carefully scoped feature evolution.

## Built Product Areas

The repo currently contains implementation surfaces for:

- Authentication and session handling.
- Protected role workspaces.
- Organization setup for Chains and Vendors/Branches.
- Users and operational profiles.
- Assignment records.
- Request workflows.
- New Hire.
- Picker Profile Completion.
- Resignation / Offboarding.
- Transfer.
- Annual Leave request handling.
- Deduction request handling.
- Approvals.
- Notifications.
- Audit logs.
- Reports.
- Attendance imports and reports.
- Orders KPI imports, reports, and target settings.
- Admin controls.
- Access-control foundation.
- Dashboard cache and background worker support.
- HR Google Sheets Sync backend and Apps Script package.

These surfaces must stay bounded by the product guardrails. Do not expand attendance into biometric/live punch-in tracking, deductions into payroll, or Orders KPI into live order integration unless explicitly approved.

## HR Google Sheets Sync Status

HR Sync exists for supported Picker lifecycle reporting:

```text
PICKER_NEW_HIRE
PICKER_REHIRE
PICKER_RESIGNATION
```

Current implementation facts:

- Backend env validation reads `HR_SYNC_ENABLED`, `HR_SYNC_WEB_APP_URL`, and `HR_SYNC_SECRET`.
- `HrSyncLog` tracks sync attempts.
- New Hire and Offboarding finalization services call HR sync only after supported Picker workflow finalization.
- Request detail response exposes sanitized HR sync status metadata.
- Apps Script source and sample payloads live under `scripts/google-apps-script/hr-sync`.
- The Apps Script package is not deployed automatically.

Manual Apps Script setup:

```text
1. Copy scripts/google-apps-script/hr-sync/Code.gs into a Google Apps Script project.
2. Run setupHrSync(spreadsheetUrlOrId, sharedSecret).
3. Deploy the script as a Web App.
4. Configure backend env with HR_SYNC_ENABLED=true, HR_SYNC_WEB_APP_URL, and HR_SYNC_SECRET.
5. Restart the API.
6. Verify end-to-end sync with supported Picker finalization flows.
```

Do not commit the Web App URL, spreadsheet ID, or shared secret.

## Production Hardening Priorities

Recommended next areas:

- Verify deployment path for Docker Compose / VPS.
- Strengthen automated workflow and access-control regression coverage.
- Continue page-by-page mobile UI polish.
- Keep documentation aligned with current source paths and commands.
- Verify HR Sync end to end only after real deployment configuration is available.
- Harden import/report workflows without expanding product scope.
- Keep access roles additive and audited.

## Known Risks

- Some services are large and should be split only in scoped refactor slices.
- Some current modules are broader than the core product brief and need careful scope language.
- Automated coverage is uneven across modules.
- Production deployment process is not documented as a completed release procedure.
- HR Sync depends on external Apps Script deployment and secret configuration.

## Roadmap Rule

Each new workstream must be a small scoped slice with:

- Current behavior inspection.
- Product problem statement.
- Explicit out-of-scope list.
- Security/access-control review.
- Verification plan.
- Manual verification notes where relevant.
