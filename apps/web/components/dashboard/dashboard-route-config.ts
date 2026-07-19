import type { UserRole } from "@/lib/auth/types";

export type DashboardRouteConfig = {
  allowedRoles: UserRole[];
  description: string;
  hideHeaderDescription?: boolean;
  showPageTitle?: boolean;
  title: string;
};

const ALL_WORKSPACE_ROLES: UserRole[] = [
  "PICKER",
  "CHAMP",
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];

const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

const exactRoutes: Record<string, DashboardRouteConfig> = {
  "/admin/archived-users": {
    allowedRoles: ADMIN_ROLES,
    description: "Archived and deactivated user visibility.",
    title: "Archived Users"
  },
  "/admin/attendance/imports": {
    allowedRoles: ADMIN_ROLES,
    description: "Upload, preview, and confirm monthly Picker attendance batches.",
    title: "Attendance Imports"
  },
  "/admin/attendance/imports/historical": {
    allowedRoles: ADMIN_ROLES,
    description: "Import a closed historical monthly attendance batch.",
    title: "Historical Attendance Import"
  },
  "/admin/audit-logs": {
    allowedRoles: ADMIN_ROLES,
    description: "Sensitive action history.",
    title: "Audit Logs"
  },
  "/admin/dashboard": {
    allowedRoles: ADMIN_ROLES,
    description: "Admin performance overview",
    title: "Dashboard"
  },
  "/admin/imports": {
    allowedRoles: ADMIN_ROLES,
    description: "Admin import workflows for operational files.",
    showPageTitle: true,
    title: "Imports"
  },
  "/admin/imports/orders-kpi": {
    allowedRoles: ADMIN_ROLES,
    description: "Upload, preview, review, and confirm Orders KPI daily snapshots.",
    title: "Orders KPI Import"
  },
  "/admin/organization": {
    allowedRoles: ADMIN_ROLES,
    description: "Chains, Branches, and assignment setup.",
    showPageTitle: true,
    title: "Organization"
  },
  "/admin/reports": {
    allowedRoles: ADMIN_ROLES,
    description: "Reports available for the Admin workspace.",
    title: "Reports"
  },
  "/admin/reports/attendance": {
    allowedRoles: ADMIN_ROLES,
    description: "Read-only Picker attendance rows from confirmed active batches.",
    title: "Attendance Report"
  },
  "/admin/reports/operations-analysis": {
    allowedRoles: ADMIN_ROLES,
    description: "Read-only operational analysis from existing system data.",
    showPageTitle: true,
    title: "Operations Analysis"
  },
  "/admin/reports/orders-kpi": {
    allowedRoles: ADMIN_ROLES,
    description: "Vendor-first operational KPI workspace.",
    showPageTitle: true,
    title: "Orders KPI Performance"
  },
  "/admin/settings": {
    allowedRoles: ADMIN_ROLES,
    description: "Workspace preferences and system configuration.",
    showPageTitle: true,
    title: "Settings"
  },
  "/admin/settings/orders-kpi-targets": {
    allowedRoles: ADMIN_ROLES,
    description: "Global Orders KPI target thresholds.",
    title: "Orders KPI Targets"
  },
  "/area-manager/dashboard": {
    allowedRoles: ["AREA_MANAGER"],
    description: "Chain, branch, and scoped user visibility.",
    hideHeaderDescription: true,
    title: "Dashboard"
  },
  "/area-manager/reports": {
    allowedRoles: ["AREA_MANAGER"],
    description: "Reports available for your assigned Chain scope.",
    title: "Reports"
  },
  "/area-manager/reports/attendance": {
    allowedRoles: ["AREA_MANAGER"],
    description: "Read-only attendance scoped to current operational assignments.",
    title: "Attendance Report"
  },
  "/area-manager/reports/operations-analysis": {
    allowedRoles: ["AREA_MANAGER"],
    description: "Read-only operational analysis scoped to your assigned Chains.",
    showPageTitle: true,
    title: "Operations Analysis"
  },
  "/area-manager/reports/orders-kpi": {
    allowedRoles: ["AREA_MANAGER"],
    description: "Orders KPI performance scoped to your assigned chains.",
    showPageTitle: true,
    title: "Orders KPI Performance"
  },
  "/champ/branches": {
    allowedRoles: ["CHAMP"],
    description: "Branch-first Champ operations.",
    showPageTitle: true,
    title: "My Branches"
  },
  "/champ/dashboard": {
    allowedRoles: ["CHAMP"],
    description: "Branch performance overview.",
    title: "Dashboard"
  },
  "/champ/reports": {
    allowedRoles: ["CHAMP"],
    description: "Reports available for your assigned Branch scope.",
    title: "Reports"
  },
  "/champ/reports/attendance": {
    allowedRoles: ["CHAMP"],
    description: "Read-only attendance scoped to assigned branches and Pickers.",
    title: "Attendance Report"
  },
  "/champ/reports/operations-analysis": {
    allowedRoles: ["CHAMP"],
    description: "Read-only operational analysis scoped to your assigned Branches.",
    showPageTitle: true,
    title: "Operations Analysis"
  },
  "/champ/reports/orders-kpi": {
    allowedRoles: ["CHAMP"],
    description: "Orders KPI performance scoped to your assigned branches.",
    showPageTitle: true,
    title: "Orders KPI Performance"
  },
  "/deductions": {
    allowedRoles: ALL_WORKSPACE_ROLES,
    description: "Operational penalty tracking scoped to your role.",
    showPageTitle: true,
    title: "Deductions"
  },
  "/notifications": {
    allowedRoles: ALL_WORKSPACE_ROLES,
    description: "In-app workflow updates.",
    showPageTitle: true,
    title: "Notifications"
  },
  "/picker/attendance": {
    allowedRoles: ["PICKER"],
    description: "Your own attendance score, shift history, and clean-shift progress.",
    title: "My Attendance"
  },
  "/picker/dashboard": {
    allowedRoles: ["PICKER"],
    description: "Personal attendance, orders, ranking, deductions, leave, and notifications.",
    title: "My Workday"
  },
  "/settings": {
    allowedRoles: ALL_WORKSPACE_ROLES,
    description: "Workspace preferences and system configuration.",
    showPageTitle: true,
    title: "Settings"
  },
  "/settings/appearance": {
    allowedRoles: ALL_WORKSPACE_ROLES,
    description: "Personal appearance controls for your SuperNova workspace.",
    showPageTitle: true,
    title: "Appearance"
  },
  "/settings/deductions": {
    allowedRoles: ADMIN_ROLES,
    description: "Occurrence rules applied by Deduction tickets.",
    showPageTitle: true,
    title: "Deduction Policy"
  },
  "/super-admin/access-control": {
    allowedRoles: ["SUPER_ADMIN"],
    description: "Permission catalog and system role matrix.",
    title: "Access Control"
  },
  "/tickets": {
    allowedRoles: ALL_WORKSPACE_ROLES,
    description: "Operational lifecycle tickets, approvals, and final actions.",
    hideHeaderDescription: true,
    showPageTitle: true,
    title: "Tickets"
  },
  "/users": {
    allowedRoles: ["CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"],
    description: "",
    hideHeaderDescription: true,
    showPageTitle: true,
    title: "Users"
  }
};

const dynamicRoutes: Array<[RegExp, DashboardRouteConfig]> = [
  [
    /^\/champ\/branches\/[^/]+\/new-hire$/,
    {
      allowedRoles: ["CHAMP"],
      description: "Create a Branch-scoped New Hire request.",
      title: "New Hire"
    }
  ],
  [
    /^\/champ\/branches\/[^/]+\/resignation$/,
    {
      allowedRoles: ["CHAMP"],
      description: "Create a Branch-scoped Picker resignation request.",
      title: "Resignation"
    }
  ],
  [
    /^\/champ\/branches\/[^/]+\/transfer$/,
    {
      allowedRoles: ["CHAMP"],
      description: "Create a Branch-scoped Picker Transfer request.",
      title: "Transfer Picker"
    }
  ],
  [
    /^\/champ\/branches\/[^/]+$/,
    {
      allowedRoles: ["CHAMP"],
      description: "Branch Pickers, requests, and actions.",
      title: "Branch Dashboard"
    }
  ]
];

export function getDashboardRouteConfig(pathname: string) {
  const path = normalizePathname(pathname);
  const exact = exactRoutes[path];

  if (exact) {
    return exact;
  }

  return dynamicRoutes.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

function normalizePathname(pathname: string) {
  const cleanPath = pathname.split("?")[0] || "/";

  if (cleanPath === "/") {
    return cleanPath;
  }

  return cleanPath.replace(/\/+$/, "");
}
