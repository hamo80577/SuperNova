export const usersResetHeader = {
  description: "Operational workforce, assignments, and lifecycle movement.",
  title: "Users"
} as const;

export const roleSelectorCards = [
  {
    active: true,
    count: "1,345",
    id: "pickers",
    subtitle: "Active workforce",
    title: "All Pickers"
  },
  {
    active: false,
    count: "4",
    id: "champs",
    subtitle: "Branch leaders",
    title: "All Champs"
  },
  {
    active: false,
    count: "3",
    id: "management",
    subtitle: "Admins & Area Managers",
    title: "Management Users"
  }
] as const;

export const movementKpiCards = [
  {
    helper: "Active at Apr 1",
    id: "starting-headcount",
    label: "Starting Headcount",
    tone: "blue",
    trend: "+3.6% vs last month",
    value: "1,345"
  },
  {
    helper: "Completed onboarding",
    id: "new-hires",
    label: "New Hires",
    tone: "green",
    trend: "+18.7% vs last month",
    value: "120"
  },
  {
    helper: "Completed exits",
    id: "exited",
    label: "Exited",
    tone: "red",
    trend: "+12.9% vs last month",
    value: "67"
  },
  {
    helper: "Active at Apr 30",
    id: "ending-headcount",
    label: "Ending Headcount",
    tone: "violet",
    trend: "+4.2% vs last month",
    value: "1,398"
  },
  {
    helper: "Exited / Avg HC",
    id: "attrition-rate",
    label: "Attrition Rate",
    tone: "orange",
    trend: "+1.1pp vs last month",
    value: "5.1%"
  },
  {
    helper: "Hires - Exits",
    id: "net-movement",
    label: "Net Movement",
    tone: "emerald",
    trend: "+26.5% vs last month",
    value: "+53"
  }
] as const;

export const directoryPlaceholder = {
  description: "Search, filter, and inspect operational users.",
  emptyState:
    "Static placeholder directory for the reset phase. Live user APIs remain disconnected.",
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

export const userDirectoryRows = [
  {
    contact: "+20 123 456 7876",
    context: {
      branch: "Carrefour HCC / Hurghada",
      chain: "Carrefour",
      since: "Since May 26, 2026"
    },
    idLabel: "Shopper ID 012345678",
    lifecycle: "Active",
    manager: "Kevin M.",
    managerRole: "Area Manager",
    name: "Mohammed Mahmoud",
    role: "Picker"
  },
  {
    contact: "+20 121 212 1213",
    context: {
      branch: "Carrefour Maadi",
      chain: "Carrefour",
      since: "Since May 14, 2026"
    },
    idLabel: "Shopper ID 012199634349",
    lifecycle: "Active",
    manager: "Kevin M.",
    managerRole: "Area Manager",
    name: "Ahmed Samir",
    role: "Picker"
  },
  {
    contact: "+20 111 234 5434",
    context: {
      branch: "Carrefour City Stars",
      chain: "Carrefour",
      since: "Since May 20, 2026"
    },
    idLabel: "Shopper ID 01123454343",
    lifecycle: "Pending Request",
    manager: "Kevin M.",
    managerRole: "Area Manager",
    name: "Omar Hassan",
    role: "Picker"
  },
  {
    contact: "+20 107 897 8078",
    context: {
      branch: "Carrefour HCC / Hurghada",
      chain: "Carrefour",
      since: "Since May 18, 2026"
    },
    idLabel: "Shopper ID 01073670978",
    lifecycle: "Active",
    manager: "Kevin M.",
    managerRole: "Area Manager",
    name: "Mohamed Ali",
    role: "Champ"
  },
  {
    contact: "+20 101 112 2334",
    context: {
      branch: "Carrefour Maadi",
      chain: "Carrefour",
      since: "Since Jun 01, 2026"
    },
    idLabel: "Shopper ID 01011223344",
    lifecycle: "Active",
    manager: "Kevin M.",
    managerRole: "Area Manager",
    name: "Youssef Nabil",
    role: "Champ"
  },
  {
    contact: "+20 102 123 4576",
    context: {
      branch: "North Cairo",
      chain: "Area Management",
      since: "Since Jan 10, 2026"
    },
    idLabel: "Admin ID ADM-003",
    lifecycle: "Active",
    manager: "Operations Lead",
    managerRole: "Management",
    name: "Ahmed Samy",
    role: "Area Manager"
  }
] as const;

export const usersPaginationPlaceholder = {
  page: 1,
  pageSize: 10,
  rangeLabel: "Showing 1 to 6 of 1,522 users"
} as const;
