-- Enforce one active access-role assignment per user/access-role pair while
-- preserving multiple inactive historical rows for the same pair.
CREATE UNIQUE INDEX "UserAccessRoleAssignment_active_user_role_unique"
ON "UserAccessRoleAssignment"("userId", "accessRoleId")
WHERE "status" = 'ACTIVE';
