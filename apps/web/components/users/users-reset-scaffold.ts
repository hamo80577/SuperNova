export const usersResetHeader = {
  description: "Operational workforce, assignments, and lifecycle movement.",
  title: "Users"
} as const;

export const roleSwitcherPlaceholders = [
  "All Pickers",
  "All Champs",
  "Management Users"
] as const;

export const movementPlaceholders = [
  "Starting Headcount",
  "New Hires",
  "Exited",
  "Ending Headcount",
  "Attrition Rate",
  "Net Movement"
] as const;

export const directoryPlaceholder = {
  description: "Search, filter, and inspect operational users.",
  emptyState:
    "The Users page UI has been reset. The new directory experience will be rebuilt in the next phase.",
  title: "User Directory"
} as const;
