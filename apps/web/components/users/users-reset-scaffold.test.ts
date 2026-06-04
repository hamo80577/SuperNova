import {
  directoryPlaceholder,
  movementPlaceholders,
  roleSwitcherPlaceholders,
  usersResetHeader
} from "./users-reset-scaffold";

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
  assert.deepEqual(usersResetHeader, {
    description: "Operational workforce, assignments, and lifecycle movement.",
    title: "Users"
  });
}

{
  assert.deepEqual(roleSwitcherPlaceholders, [
    "All Pickers",
    "All Champs",
    "Management Users"
  ]);
}

{
  assert.deepEqual(movementPlaceholders, [
    "Starting Headcount",
    "New Hires",
    "Exited",
    "Ending Headcount",
    "Attrition Rate",
    "Net Movement"
  ]);
}

{
  assert.equal(directoryPlaceholder.title, "User Directory");
  assert.equal(
    directoryPlaceholder.description,
    "Search, filter, and inspect operational users."
  );
  assert.equal(
    directoryPlaceholder.emptyState,
    "The Users page UI has been reset. The new directory experience will be rebuilt in the next phase."
  );
}
