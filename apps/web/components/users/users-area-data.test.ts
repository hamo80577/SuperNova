import {
  deriveVisibleFilterOptions,
  getVisibleUserSections,
  isRoleAllowedInUsersSection,
  keepUsersSectionItems,
  sanitizeFiltersForOptions
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

const filterLinks = [
  {
    areaManager: { hint: "0100", id: "am-north", label: "North AM" },
    chain: { hint: "CRF", id: "chain-carrefour", label: "Carrefour" },
    champ: { hint: "0111", id: "champ-hcc", label: "HCC Champ" },
    vendor: { hint: "HCC", id: "branch-hcc", label: "Carrefour HCC" }
  },
  {
    areaManager: { hint: "0100", id: "am-north", label: "North AM" },
    chain: { hint: "CRF", id: "chain-carrefour", label: "Carrefour" },
    champ: { hint: "0122", id: "champ-maadi", label: "Maadi Champ" },
    vendor: { hint: "MAD", id: "branch-maadi", label: "Carrefour Maadi" }
  },
  {
    areaManager: { hint: "0109", id: "am-east", label: "East AM" },
    chain: { hint: "SPN", id: "chain-spinneys", label: "Spinneys" },
    champ: { hint: "0133", id: "champ-alex", label: "Alex Champ" },
    vendor: { hint: "ALX", id: "branch-alex", label: "Spinneys Alex" }
  }
];

const noFilters = {
  areaManagerId: "",
  chainId: "",
  champId: "",
  vendorId: ""
};

{
  const options = deriveVisibleFilterOptions(
    { ...noFilters, chainId: "chain-carrefour" },
    filterLinks
  );

  assert.deepEqual(
    options.vendors.map((option) => option.id),
    ["branch-hcc", "branch-maadi"]
  );
  assert.deepEqual(
    options.champs.map((option) => option.id),
    ["champ-hcc", "champ-maadi"]
  );
  assert.deepEqual(
    options.areaManagers.map((option) => option.id),
    ["am-north"]
  );
}

{
  const options = deriveVisibleFilterOptions(
    { ...noFilters, vendorId: "branch-hcc" },
    filterLinks
  );

  assert.deepEqual(
    options.chains.map((option) => option.id),
    ["chain-carrefour"]
  );
  assert.deepEqual(
    options.champs.map((option) => option.id),
    ["champ-hcc"]
  );
  assert.deepEqual(
    options.areaManagers.map((option) => option.id),
    ["am-north"]
  );
}

{
  const options = deriveVisibleFilterOptions(
    { ...noFilters, champId: "champ-hcc" },
    filterLinks
  );

  assert.deepEqual(
    options.vendors.map((option) => option.id),
    ["branch-hcc"]
  );
  assert.deepEqual(
    options.chains.map((option) => option.id),
    ["chain-carrefour"]
  );
}

{
  const options = deriveVisibleFilterOptions(
    { ...noFilters, areaManagerId: "am-north" },
    filterLinks
  );

  assert.deepEqual(
    options.chains.map((option) => option.id),
    ["chain-carrefour"]
  );
  assert.deepEqual(
    options.vendors.map((option) => option.id),
    ["branch-hcc", "branch-maadi"]
  );
  assert.deepEqual(
    options.champs.map((option) => option.id),
    ["champ-hcc", "champ-maadi"]
  );
}

{
  const sanitized = sanitizeFiltersForOptions(
    {
      areaManagerId: "am-north",
      chainId: "chain-spinneys",
      champId: "champ-hcc",
      vendorId: "branch-hcc"
    },
    deriveVisibleFilterOptions(
      { ...noFilters, chainId: "chain-spinneys" },
      filterLinks
    )
  );

  assert.deepEqual(sanitized, {
    areaManagerId: "",
    chainId: "chain-spinneys",
    champId: "",
    vendorId: ""
  });
}

{
  const options = deriveVisibleFilterOptions(noFilters, []);
  assert.deepEqual(options, {
    areaManagers: [],
    chains: [],
    champs: [],
    vendors: []
  });
  assert.deepEqual(sanitizeFiltersForOptions(noFilters, options), noFilters);
}

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
