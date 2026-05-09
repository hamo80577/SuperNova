import {
  Archive,
  ClipboardList,
  Bell,
  BarChart3,
  FileSearch,
  GitBranch,
  Home,
  Map,
  Network,
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
}

export const roleNavigation: Record<UserRole, NavItem[]> = {
  PICKER: [
    { label: "Dashboard", href: "/picker/dashboard", active: true, icon: Home },
    { label: "My Requests", href: "/requests", icon: ClipboardList },
    { label: "My Profile", disabled: true, icon: UserRound },
    {
      label: "Profile Completion",
      href: "/picker/profile-completion",
      icon: ShieldCheck
    }
  ],
  CHAMP: [
    { label: "Dashboard", href: "/champ/dashboard", active: true, icon: Home },
    { label: "My Branches", href: "/champ/branches", icon: Store },
    { label: "Reports", href: "/champ/reports", icon: BarChart3 },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Pending Actions", href: "/approvals", icon: ShieldCheck },
    { label: "Notifications", href: "/notifications", icon: Bell }
  ],
  AREA_MANAGER: [
    {
      label: "Dashboard",
      href: "/area-manager/dashboard",
      active: true,
      icon: Home
    },
    { label: "Operations Map", disabled: true, icon: Map },
    { label: "Users Under Me", disabled: true, icon: Users },
    { label: "Reports", href: "/area-manager/reports", icon: BarChart3 },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Notifications", href: "/notifications", icon: Bell }
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: Home },
    { label: "Users", disabled: true, icon: Users },
    { label: "Chains", href: "/admin/chains", icon: GitBranch },
    { label: "Vendors", href: "/admin/vendors", icon: Store },
    { label: "Assignments", href: "/admin/assignments", icon: Network },
    { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    { label: "Pending Actions", href: "/admin/pending-actions", icon: ShieldCheck },
    { label: "Archived Users", href: "/admin/archived-users", icon: Archive },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: FileSearch },
    { label: "Settings", href: "/admin/settings", icon: Settings }
  ],
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: Home },
    { label: "Users", disabled: true, icon: Users },
    { label: "Chains", href: "/admin/chains", icon: GitBranch },
    { label: "Vendors", href: "/admin/vendors", icon: Store },
    { label: "Assignments", href: "/admin/assignments", icon: Network },
    { label: "Reports", href: "/admin/reports", icon: BarChart3 },
    { label: "Pending Actions", href: "/admin/pending-actions", icon: ShieldCheck },
    { label: "Archived Users", href: "/admin/archived-users", icon: Archive },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: FileSearch },
    { label: "Settings", href: "/admin/settings", icon: Settings }
  ]
};
