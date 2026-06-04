import {
  getVisibleUserSections,
  isRoleAllowedInUsersSection,
  keepUsersSectionItems
} from "./users-area-data";
import type { UserRole } from "@/lib/auth/types";

const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    }
  },
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

{
  assert.deepEqual(
    getVisibleUserSections("CHAMP").map((section) => section.id),
    ["pickers"]
  );
  assert.deepEqual(
    getVisibleUserSections("AREA_MANAGER").map((section) => section.id),
    ["pickers", "champs"]
  );
  assert.deepEqual(
    getVisibleUserSections("ADMIN").map((section) => section.id),
    ["pickers", "champs", "management"]
  );
}

{
  assert.equal(isRoleAllowedInUsersSection("pickers", "PICKER"), true);
  assert.equal(isRoleAllowedInUsersSection("pickers", "CHAMP"), false);
  assert.equal(isRoleAllowedInUsersSection("champs", "CHAMP"), true);
  assert.equal(isRoleAllowedInUsersSection("champs", "AREA_MANAGER"), false);
  assert.equal(isRoleAllowedInUsersSection("management", "AREA_MANAGER"), true);
  assert.equal(isRoleAllowedInUsersSection("management", "ADMIN"), true);
  assert.equal(isRoleAllowedInUsersSection("management", "SUPER_ADMIN"), true);
  assert.equal(isRoleAllowedInUsersSection("management", "PICKER"), false);
}

{
  const items: Array<{ key: string; user: { role: UserRole } }> = [
    { key: "picker", user: { role: "PICKER" } },
    { key: "champ", user: { role: "CHAMP" } },
    { key: "area-manager", user: { role: "AREA_MANAGER" } },
    { key: "admin", user: { role: "ADMIN" } }
  ];

  assert.deepEqual(
    keepUsersSectionItems("pickers", items).map((item) => item.key),
    ["picker"]
  );
  assert.deepEqual(
    keepUsersSectionItems("champs", items).map((item) => item.key),
    ["champ"]
  );
  assert.deepEqual(
    keepUsersSectionItems("management", items).map((item) => item.key),
    ["area-manager", "admin"]
  );
}
