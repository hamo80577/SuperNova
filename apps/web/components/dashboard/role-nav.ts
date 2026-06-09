import {
  Archive,
  ClipboardList,
  Bell,
  BarChart3,
  CalendarDays,
  FileSearch,
  GitBranch,
  Home,
  KeyRound,
  Map,
  Settings,
  ShieldCheck,
  Store,
  UploadCloud,
  UserRound,
  Users
} from "lucide-react";

import type { UserRole } from "@/lib/auth/types";

export interface NavItem {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  icon: typeof Home;
  section?: string;
}

export const roleNavigation: Record<UserRole, NavItem[]> = {
  PICKER: [
    {
      label: "Dashboard",
      href: "/picker/dashboard",
      active: true,
      icon: Home,
      section: "Workspace"
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: ClipboardList,
      section: "Operations"
    },
    {
      label: "Attendance",
      href: "/picker/attendance",
      icon: CalendarDays,
      section: "Operations"
    },
    {
      label: "My Profile",
      disabled: true,
      icon: UserRound,
      section: "Profile"
    },
    {
      label: "Profile Completion",
      href: "/picker/profile-completion",
      icon: ShieldCheck,
      section: "Profile"
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      section: "Settings"
    }
  ],
  CHAMP: [
    {
      label: "Dashboard",
      href: "/champ/dashboard",
      active: true,
      icon: Home,
      section: "Workspace"
    },
    {
      label: "My Branches",
      href: "/champ/branches",
      icon: Store,
      section: "Operations"
    },
    {
      label: "Users",
      href: "/users",
      icon: Users,
      section: "Operations"
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: ClipboardList,
      section: "Requests & Approvals"
    },
    {
      label: "Reports",
      href: "/champ/reports",
      icon: BarChart3,
      section: "Reports"
    },
    {
      label: "Attendance",
      href: "/champ/reports/attendance",
      icon: CalendarDays,
      section: "Reports"
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      section: "Workspace"
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      section: "Settings"
    }
  ],
  AREA_MANAGER: [
    {
      label: "Dashboard",
      href: "/area-manager/dashboard",
      active: true,
      icon: Home,
      section: "Workspace"
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      section: "Workspace"
    },
    {
      label: "Operations Map",
      disabled: true,
      icon: Map,
      section: "Operations"
    },
    {
      label: "Users",
      href: "/users",
      icon: Users,
      section: "Operations"
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: ClipboardList,
      section: "Requests & Approvals"
    },
    {
      label: "Reports",
      href: "/area-manager/reports",
      icon: BarChart3,
      section: "Reports"
    },
    {
      label: "Attendance",
      href: "/area-manager/reports/attendance",
      icon: CalendarDays,
      section: "Reports"
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      section: "Settings"
    }
  ],
  ADMIN: [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: Home,
      section: "Workspace"
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      section: "Workspace"
    },
    {
      label: "Organization",
      href: "/admin/organization",
      icon: GitBranch,
      section: "Organization Setup"
    },
    {
      label: "Users",
      href: "/users",
      icon: Users,
      section: "Organization Setup"
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: ClipboardList,
      section: "Requests & Approvals"
    },
    {
      label: "Reports",
      href: "/admin/reports",
      icon: BarChart3,
      section: "Reports"
    },
    {
      label: "Attendance",
      href: "/admin/reports/attendance",
      icon: CalendarDays,
      section: "Reports"
    },
    {
      label: "Attendance Imports",
      href: "/admin/attendance/imports",
      icon: UploadCloud,
      section: "Reports"
    },
    {
      label: "Archived Users",
      href: "/admin/archived-users",
      icon: Archive,
      section: "Admin Controls"
    },
    {
      label: "Audit Logs",
      href: "/admin/audit-logs",
      icon: FileSearch,
      section: "Admin Controls"
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      section: "Settings"
    }
  ],
  SUPER_ADMIN: [
    {
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: Home,
      section: "Workspace"
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      section: "Workspace"
    },
    {
      label: "Organization",
      href: "/admin/organization",
      icon: GitBranch,
      section: "Organization Setup"
    },
    {
      label: "Users",
      href: "/users",
      icon: Users,
      section: "Organization Setup"
    },
    {
      label: "Tickets",
      href: "/tickets",
      icon: ClipboardList,
      section: "Requests & Approvals"
    },
    {
      label: "Reports",
      href: "/admin/reports",
      icon: BarChart3,
      section: "Reports"
    },
    {
      label: "Attendance",
      href: "/admin/reports/attendance",
      icon: CalendarDays,
      section: "Reports"
    },
    {
      label: "Attendance Imports",
      href: "/admin/attendance/imports",
      icon: UploadCloud,
      section: "Reports"
    },
    {
      label: "Archived Users",
      href: "/admin/archived-users",
      icon: Archive,
      section: "Admin Controls"
    },
    {
      label: "Audit Logs",
      href: "/admin/audit-logs",
      icon: FileSearch,
      section: "Admin Controls"
    },
    {
      label: "Access Control",
      href: "/super-admin/access-control",
      icon: KeyRound,
      section: "System Owner"
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      section: "Settings"
    }
  ]
};
