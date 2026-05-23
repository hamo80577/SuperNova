# Phase 7 Stabilization Report

## Summary

Phase 7B through Phase 7H.1 were verified together on May 22, 2026.

The DB-backed access-role foundation is additive. `User.role`, `UserRole`, `@Roles`, `RolesGuard`, `ApprovalStep`, `RequestApproval.approverRole`, assignment-table scope, and lifecycle workflow services remain in place.

Runtime authorization still preserves the synchronous `AccessPolicyService` public API:

```ts
hasPermission(actor, permissionKey)
can(actor, permissionKey, context?)
assertCan(actor, permissionKey, context?)
```

`AccessPolicyService` may load active SYSTEM access-role permissions from the database on startup. If the database rows are missing, incomplete, or invalid, it falls back to the code matrix.

`UserAccessRoleAssignment` is now read by `AccessPolicyService` for ACTIVE CUSTOM access-role assignments only. These grants are additive user-specific permissions. They do not change `User.role`, workspace routing, operational assignment scope, approval ownership, request status rules, workflow finalization, audit behavior, or notification behavior.

SYSTEM access-role assignments are ignored. SYSTEM role permissions remain code-owned through `SYSTEM_ROLE_PERMISSIONS` and are mirrored to DB by `prisma/access-role-seed.ts`.

No custom-role assignment mutation API, role-management UI, or Picker-to-Champ promotion flow exists. Manual DB changes to CUSTOM access roles or assignments can affect authorization after API restart and must be treated as privileged operational changes until audited APIs exist.

## Phase 7 Coverage

- Phase 7A: DB-backed custom-role foundation design documented.
- Phase 7B: `AccessRole` and `AccessRolePermission` Prisma schema and migration added.
- Phase 7C: idempotent SYSTEM access-role seed/sync added from `SYSTEM_ROLE_PERMISSIONS`.
- Phase 7D: `UserAccessRoleAssignment` schema foundation added.
- Phase 7E: `AccessPolicyService` prepared to load DB-backed SYSTEM role permissions with code-matrix fallback.
- Phase 7H: `AccessPolicyService` prepared to read ACTIVE CUSTOM user access-role assignments as additive permission grants.
- Phase 7H.1: CUSTOM grants were tightened so permissions must exist in the catalog, be assignable, and not be system-only.

No custom-role assignment mutation API, role-management UI, or Picker-to-Champ promotion flow was added.

## Diff Scope Audit

Branch diff against `origin/main` is limited to accepted access-control work, accepted Phase 4 read-only frontend files, Phase 7 schema/seed/service/test files, and Phase 7A documentation.

Expected Phase 7 areas are present:

- `prisma/schema.prisma`
- `prisma/migrations/20260522111246_add_access_roles/migration.sql`
- `prisma/migrations/20260522121209_add_user_access_role_assignments/migration.sql`
- `prisma/access-role-seed.ts`
- `prisma/seed.ts`
- `apps/api/src/access-control/access-policy.service.ts`
- `apps/api/test/access-control-policy.service.test.ts`
- `apps/api/test/access-control-system-role-seed.test.ts`
- `docs/access-control/PHASE_7A_SCHEMA_DESIGN.md`
- `docs/access-control/PHASE_7G_USER_ACCESS_ROLE_ASSIGNMENT_RULES.md`

Forbidden Phase 7 areas were checked. No branch diff was found under request workflow services, request approval routing, assignment services, `UsersService`, `ReportsService`, or `NotificationsService`.

The only frontend branch diff remains the accepted Phase 4 read-only Access Control page/nav/API surface:

- `apps/web/app/super-admin/access-control/page.tsx`
- `apps/web/components/access-control/access-control-overview-page.tsx`
- `apps/web/components/dashboard/role-nav.ts`
- `apps/web/lib/api/access-control.ts`

## Migration Audit

`20260522111246_add_access_roles` creates:

- `AccessRoleKind`
- `AccessRoleStatus`
- `AccessRole`
- `AccessRolePermission`
- unique/index constraints for `AccessRole` and `AccessRolePermission`
- `AccessRolePermission.accessRoleId` foreign key to `AccessRole`

`20260522121209_add_user_access_role_assignments` creates:

- `AccessRoleAssignmentStatus`
- `UserAccessRoleAssignment`
- indexes for user, access role, and status lookup
- foreign keys to `User` and `AccessRole`

Confirmed:

- No destructive operations.
- No workflow tables altered.
- `User.role` remains intact.
- `RequestApproval.approverRole` remains intact.
- No `Permission` table.
- No Tenant/Country tables.
- No `UserAccessRoleAssignment` unique constraint that would block multiple inactive history rows.

## Seed and Idempotency Verification

`npm run db:seed` was run twice successfully.

Both runs reported:

```text
Synced system access roles from permission matrix: 5 roles, 98 permissions.
```

Database verification after each run:

| System Role | Access Role Key | Permission Count |
| --- | --- | ---: |
| ADMIN | `system.admin` | 30 |
| AREA_MANAGER | `system.area_manager` | 14 |
| CHAMP | `system.champ` | 11 |
| PICKER | `system.picker` | 6 |
| SUPER_ADMIN | `system.super_admin` | 37 |

Additional seed verification:

- SYSTEM `AccessRole` rows: 5
- CUSTOM `AccessRole` rows: 0
- Total `AccessRole` rows: 5
- SYSTEM `AccessRolePermission` rows: 98
- Duplicate SYSTEM permission pairs: 0
- `UserAccessRoleAssignment` rows: 0

The second seed run produced the same counts, confirming idempotency for system roles and permissions.

## DB Cache Behavior

With seeded DB rows, a direct local probe against the built `AccessPolicyService` loaded DB-backed SYSTEM role permissions with:

```json
{
  "fallbackWarningCount": 0,
  "hasPermissionResult": true,
  "canResult": true,
  "publicMethodsRemainSynchronous": true
}
```

The API also started and responded to health checks after the DB seed was present.

The DB cache is startup-loaded only. Permission changes made after startup require a process restart or a future refresh/invalidation design.

SYSTEM role permissions are code-owned in this phase:

- `SYSTEM_ROLE_PERMISSIONS` is the source of truth.
- DB SYSTEM rows are seeded mirrors of the code matrix.
- Running `npm run db:seed` syncs DB SYSTEM permissions back to the code matrix.
- Do not manually edit SYSTEM role permission rows in the database in this phase.
- DB-owned SYSTEM role management is a future explicit product decision.

ACTIVE CUSTOM user assignments are also startup-loaded. CUSTOM permission grants are accepted only when every permission exists in the catalog, `assignable === true`, and `systemOnly !== true`. If any active CUSTOM assignment includes an unknown, non-assignable, or system-only permission, the custom assignment cache is ignored and base system-role permissions still apply.

## Fallback Behavior

`apps/api/test/access-control-policy.service.test.ts` verifies:

- no-Prisma fallback works
- valid DB cache works
- empty DB fallback works
- missing system role fallback works
- unknown permission fallback works
- fallback does not throw during `onModuleInit`
- ACTIVE CUSTOM `UserAccessRoleAssignment` rows are additive only
- SYSTEM user access-role assignments are ignored
- inactive, expired, and future assignments are ignored
- unknown, non-assignable, or system-only CUSTOM role permissions disable the custom assignment cache safely
- public methods remain synchronous

Fallback warning logs are expected in the invalid/empty mocked DB cases covered by the test.

## Tests and Checks Run

Focused access-control tests:

```powershell
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-policy.service.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-system-role-seed.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-role-permission-matrix.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-permissions.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/access-control-overview.controller.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/reports-access-policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/notifications-access-policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-access-policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/requests-access-policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/approvals-access-policy.test.ts
```

Workflow and user regression tests present in the repo:

```powershell
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/request-approval-routing.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/transfer-workflow.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.rehire.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/new-hire-workflow.approval.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.policy.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-workflow.approval-finalization.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/offboarding-payload.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-area-manager-chain-assignments.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-list-filters.test.ts
npx tsx --tsconfig apps/api/tsconfig.json apps/api/test/users-admin-profile.dto.test.ts
```

Build and schema checks:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```

All listed tests and checks completed with exit code 0.

## Dev Startup and Smoke Checks

Before startup, old listeners on ports 3000 and 4000 were checked and stopped where present.

`npm run dev` was started cleanly and verified with:

- `GET http://localhost:4000/api/health` -> 200
- `GET http://localhost:3000/login` -> 200
- `GET http://localhost:4000/api/requests` unauthenticated -> 401
- `GET http://localhost:4000/api/approvals/pending` unauthenticated -> 401
- `GET http://localhost:4000/api/users` unauthenticated -> 401

No duplicate listener remained after shutdown.

## Known Risks

- DB permission cache loads only on startup.
- Seed must run after system role matrix changes.
- SYSTEM DB permissions are seeded mirrors of the code matrix in this phase; manual SYSTEM DB edits will be overwritten by seed sync.
- DB-owned SYSTEM role management is not implemented and remains a future explicit decision.
- ACTIVE CUSTOM `UserAccessRoleAssignment` rows can affect authorization after API restart.
- Manual CUSTOM access-role and assignment DB edits are privileged operational changes until audited APIs exist.
- No custom-role assignment UI/API exists yet.
- Picker-to-Champ transition remains a separate future workflow/Admin-control problem and is not solved by access-role assignment.
- Permission strings remain code-owned and are not protected by a permission-table foreign key.
- Future custom roles could be over-permissioned if product guardrails are not designed before mutation APIs.

## Required Fixes Before Custom-Role Runtime

- Decide cache refresh/invalidation behavior for DB-backed permission changes.
- Define product rules for assigning custom roles to users.
- Define mutation/audit rules for custom-role creation and permission edits.
- Define how system role rows are locked from normal mutation.
- Keep custom roles additive only unless a future product decision explicitly changes that model.
- Keep Picker-to-Champ role transition as a separate controlled workflow/Admin-control design.

## Recommendation

Freeze the backend access-control foundation after Phase 7H.1.

The next scoped phase may proceed only after product decisions on custom-role assignment semantics, mutation audit requirements, and cache refresh behavior. If those decisions are not ready, return to UI/UX work while keeping the backend access-control foundation frozen.
