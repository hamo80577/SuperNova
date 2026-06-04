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
        active: false,
        count: "Live data",
        subtitle: "Active workforce",
        title: "All Pickers"
      },
      {
        active: false,
        count: "Live data",
        subtitle: "Branch leaders",
        title: "All Champs"
      },
      {
        active: false,
        count: "Live data",
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
        helper: "Needs workforce summary endpoint",
        label: "Starting Headcount",
        value: "Coming soon"
      },
      {
        helper: "Needs completed onboarding period data",
        label: "New Hires",
        value: "Coming soon"
      },
      {
        helper: "Needs completed exit period data",
        label: "Exited",
        value: "Coming soon"
      },
      {
        helper: "Needs end-of-period assignment snapshot",
        label: "Ending Headcount",
        value: "Coming soon"
      },
      {
        helper: "Do not calculate from visible rows",
        label: "Attrition Rate",
        value: "Coming soon"
      },
      {
        helper: "Needs hires minus exits for selected scope",
        label: "Net Movement",
        value: "Coming soon"
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
    "No static rows are rendered. Live user APIs power the directory."
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
  assert.equal(userDirectoryRows.length, 0);
}

{
  assert.deepEqual(usersPaginationPlaceholder, {
    page: 1,
    pageSize: 10,
    rangeLabel: "Pagination is loaded from the Users API."
  });
}
