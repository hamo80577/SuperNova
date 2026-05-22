import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import { SYSTEM_ROLE_PERMISSIONS } from "../src/access-control";
import {
  assertValidSystemAccessRoleDefinitions,
  SYSTEM_ACCESS_ROLE_DEFINITIONS
} from "../../../prisma/access-role-seed";

const expectedKeysByRole = new Map<UserRole, string>([
  [UserRole.PICKER, "system.picker"],
  [UserRole.CHAMP, "system.champ"],
  [UserRole.AREA_MANAGER, "system.area_manager"],
  [UserRole.ADMIN, "system.admin"],
  [UserRole.SUPER_ADMIN, "system.super_admin"]
]);

const definitionsByRole = new Map(
  SYSTEM_ACCESS_ROLE_DEFINITIONS.map((definition) => [
    definition.systemRole,
    definition
  ])
);

assert.doesNotThrow(() => assertValidSystemAccessRoleDefinitions());

assert.deepEqual(
  [...definitionsByRole.keys()].sort(),
  Object.values(UserRole).sort()
);

assert.deepEqual(
  [...definitionsByRole.keys()].sort(),
  Object.keys(SYSTEM_ROLE_PERMISSIONS).sort()
);

assert.equal(
  new Set(SYSTEM_ACCESS_ROLE_DEFINITIONS.map((definition) => definition.key))
    .size,
  SYSTEM_ACCESS_ROLE_DEFINITIONS.length
);

assert.equal(
  new Set(
    SYSTEM_ACCESS_ROLE_DEFINITIONS.map((definition) => definition.systemRole)
  ).size,
  SYSTEM_ACCESS_ROLE_DEFINITIONS.length
);

for (const [role, expectedKey] of expectedKeysByRole) {
  const definition = definitionsByRole.get(role);

  assert.ok(definition, `Expected system access role definition for ${role}`);
  assert.equal(definition.key, expectedKey);
  assert.ok(definition.name.trim().length > 0);
  assert.ok(definition.description.trim().length > 0);
}
