import {
  directoryPlaceholder,
  directoryToolbarFilters,
  movementKpiCards,
  roleSelectorCards,
  userDirectoryRows,
  usersPaginationPlaceholder,
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
  assert.deepEqual(
    roleSelectorCards.map((card) => ({
      active: card.active,
      count: card.count,
      subtitle: card.subtitle,
      title: card.title
    })),
    [
      {
        active: true,
        count: "1,345",
        subtitle: "Active workforce",
        title: "All Pickers"
      },
      {
        active: false,
        count: "4",
        subtitle: "Branch leaders",
        title: "All Champs"
      },
      {
        active: false,
        count: "3",
        subtitle: "Admins & Area Managers",
        title: "Management Users"
      }
    ]
  );
}

{
  assert.deepEqual(
    movementKpiCards.map((card) => ({
      helper: card.helper,
      label: card.label,
      value: card.value
    })),
    [
      {
        helper: "Active at Apr 1",
        label: "Starting Headcount",
        value: "1,345"
      },
      {
        helper: "Completed onboarding",
        label: "New Hires",
        value: "120"
      },
      {
        helper: "Completed exits",
        label: "Exited",
        value: "67"
      },
      {
        helper: "Active at Apr 30",
        label: "Ending Headcount",
        value: "1,398"
      },
      {
        helper: "Exited / Avg HC",
        label: "Attrition Rate",
        value: "5.1%"
      },
      {
        helper: "Hires - Exits",
        label: "Net Movement",
        value: "+53"
      }
    ]
  );
}

{
  assert.equal(directoryPlaceholder.title, "User Directory");
  assert.equal(
    directoryPlaceholder.description,
    "Search, filter, and inspect operational users."
  );
  assert.equal(
    directoryPlaceholder.emptyState,
    "Static placeholder directory for the reset phase. Live user APIs remain disconnected."
  );
}

{
  assert.deepEqual(directoryToolbarFilters, [
    { label: "Chain", value: "All" },
    { label: "Branch", value: "All" },
    { label: "Champ", value: "All" },
    { label: "Status", value: "Active" }
  ]);
}

{
  assert.equal(userDirectoryRows.length, 6);
  assert.deepEqual(
    userDirectoryRows.map((row) => ({
      lifecycle: row.lifecycle,
      name: row.name,
      role: row.role
    })),
    [
      { lifecycle: "Active", name: "Mohammed Mahmoud", role: "Picker" },
      { lifecycle: "Active", name: "Ahmed Samir", role: "Picker" },
      { lifecycle: "Pending Request", name: "Omar Hassan", role: "Picker" },
      { lifecycle: "Active", name: "Mohamed Ali", role: "Champ" },
      { lifecycle: "Active", name: "Youssef Nabil", role: "Champ" },
      { lifecycle: "Active", name: "Ahmed Samy", role: "Area Manager" }
    ]
  );
}

{
  assert.deepEqual(usersPaginationPlaceholder, {
    page: 1,
    pageSize: 10,
    rangeLabel: "Showing 1 to 6 of 1,522 users"
  });
}
