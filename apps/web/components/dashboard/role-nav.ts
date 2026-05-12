import {
  Archive,
  ClipboardList,
  Bell,
  BarChart3,
  FileSearch,
  GitBranch,
  Home,
  Map,
  Settings,
  ShieldCheck,
  Store,
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
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      section: "Workspace"
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
      label: "Users Under Me",
      disabled: true,
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
      href: "/admin/users",
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
      href: "/admin/settings",
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
      href: "/admin/users",
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
      href: "/admin/settings",
      icon: Settings,
      section: "Settings"
    }
  ]
};
