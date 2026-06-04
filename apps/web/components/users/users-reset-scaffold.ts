export const usersResetHeader = {
  description: "Operational workforce, assignments, and lifecycle movement.",
  title: "Users"
} as const;

export const roleSelectorCards = [
  {
    active: false,
    count: "Live data",
    id: "pickers",
    subtitle: "Active workforce",
    title: "All Pickers"
  },
  {
    active: false,
    count: "Live data",
    id: "champs",
    subtitle: "Branch leaders",
    title: "All Champs"
  },
  {
    active: false,
    count: "Live data",
    id: "management",
    subtitle: "Admins & Area Managers",
    title: "Management Users"
  }
] as const;

export const movementKpiCards = [
  {
    helper: "Needs workforce summary endpoint",
    id: "starting-headcount",
    label: "Starting Headcount",
    tone: "blue",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  },
  {
    helper: "Needs completed onboarding period data",
    id: "new-hires",
    label: "New Hires",
    tone: "green",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  },
  {
    helper: "Needs completed exit period data",
    id: "exited",
    label: "Exited",
    tone: "red",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  },
  {
    helper: "Needs end-of-period assignment snapshot",
    id: "ending-headcount",
    label: "Ending Headcount",
    tone: "violet",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  },
  {
    helper: "Do not calculate from visible rows",
    id: "attrition-rate",
    label: "Attrition Rate",
    tone: "orange",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  },
  {
    helper: "Needs hires minus exits for selected scope",
    id: "net-movement",
    label: "Net Movement",
    tone: "emerald",
    trend: "Pending real workforce summary",
    value: "Coming soon"
  }
] as const;

export const directoryPlaceholder = {
  description: "Search, filter, and inspect operational users.",
  emptyState:
    "No static rows are rendered. Live user APIs power the directory.",
  title: "User Directory"
} as const;

export const directoryToolbarFilters = [
  { label: "Chain", value: "All" },
  { label: "Branch", value: "All" },
  { label: "Champ", value: "All" },
  { label: "Status", value: "Active" }
] as const;

export const activeDirectoryChips = [
  "Status: Active",
  "Chain: Carrefour",
  "Area Manager: Ahmed S."
] as const;

export const userDirectoryRows = [] as const;

export const usersPaginationPlaceholder = {
  page: 1,
  pageSize: 10,
  rangeLabel: "Pagination is loaded from the Users API."
} as const;
