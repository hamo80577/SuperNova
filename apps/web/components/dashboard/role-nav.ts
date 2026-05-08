import {
  ClipboardList,
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
  href: string;
  active?: boolean;
  icon: typeof Home;
}

export const roleNavigation: Record<UserRole, NavItem[]> = {
  PICKER: [
    { label: "Dashboard", href: "/picker/dashboard", active: true, icon: Home },
    { label: "My Requests", href: "/requests", icon: ClipboardList },
    { label: "My Profile", href: "#", icon: UserRound },
    { label: "Profile Completion", href: "#", icon: ShieldCheck }
  ],
  CHAMP: [
    { label: "Dashboard", href: "/champ/dashboard", active: true, icon: Home },
    { label: "My Branches", href: "#", icon: Store },
    { label: "My Pickers", href: "#", icon: Users },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Pending Actions", href: "/approvals", icon: ShieldCheck }
  ],
  AREA_MANAGER: [
    {
      label: "Dashboard",
      href: "/area-manager/dashboard",
      active: true,
      icon: Home
    },
    { label: "Operations Map", href: "#", icon: Map },
    { label: "Users Under Me", href: "#", icon: Users },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck }
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: Home },
    { label: "Users", href: "#", icon: Users },
    { label: "Chains", href: "/admin/chains", icon: GitBranch },
    { label: "Vendors", href: "/admin/vendors", icon: Store },
    { label: "Assignments", href: "/admin/assignments", icon: Network },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Audit Log", href: "#", icon: ShieldCheck },
    { label: "Settings", href: "#", icon: Settings }
  ],
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: Home },
    { label: "Users", href: "#", icon: Users },
    { label: "Chains", href: "/admin/chains", icon: GitBranch },
    { label: "Vendors", href: "/admin/vendors", icon: Store },
    { label: "Assignments", href: "/admin/assignments", icon: Network },
    { label: "Requests", href: "/requests", icon: ClipboardList },
    { label: "Approvals", href: "/approvals", icon: ShieldCheck },
    { label: "Audit Log", href: "#", icon: ShieldCheck },
    { label: "Settings", href: "#", icon: Settings }
  ]
};
