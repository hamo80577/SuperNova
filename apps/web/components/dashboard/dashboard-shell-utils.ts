import { Bell, CheckCheck, ClipboardCheck, FileText } from "lucide-react";
import type { ComponentType } from "react";

import type { UserRole } from "@/lib/auth/types";
import type { NotificationCategory } from "@/lib/notifications/view-model";
import type { NavItem } from "./role-nav";

export const dashboardCopy: Record<
  UserRole,
  {
    title: string;
    description: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  PICKER: {
    title: "Picker Dashboard",
    description: "Profile, Branch context, and operational request visibility.",
    emptyTitle: "Picker workspace is active.",
    emptyBody: "Your profile status and current Branch context are enforced by backend scope."
  },
  CHAMP: {
    title: "Champ Dashboard",
    description: "Branch-first operations, Pickers, requests, and reports.",
    emptyTitle: "Champ workspace is active.",
    emptyBody: "Lifecycle actions start from a selected Branch and continue through approvals."
  },
  AREA_MANAGER: {
    title: "Area Manager Dashboard",
    description: "Chain-scoped workforce visibility and approval ownership.",
    emptyTitle: "Area Manager workspace is active.",
    emptyBody: "Approvals and reports are scoped from active Chain assignments."
  },
  ADMIN: {
    title: "Admin Control Center",
    description: "Setup, final actions, audit, and system reporting.",
    emptyTitle: "Admin control workspace is active.",
    emptyBody: "Lifecycle changes remain workflow-based; Admin surfaces expose visibility and finalization only."
  },
  SUPER_ADMIN: {
    title: "Admin Control Center",
    description: "Setup, final actions, audit, and system reporting.",
    emptyTitle: "Admin control workspace is active.",
    emptyBody: "Lifecycle changes remain workflow-based; Super Admin surfaces expose visibility and finalization only."
  }
};

export function groupNavItems(items: NavItem[]) {
  const sections = new Map<string, NavItem[]>();

  for (const item of items) {
    const section = item.section ?? "Workspace";
    sections.set(section, [...(sections.get(section) ?? []), item]);
  }

  return Array.from(sections.entries());
}

export function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getUserInitials(name?: string | null) {
  if (!name) {
    return "SN";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getNotificationTone(category: NotificationCategory): {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
} {
  const tones: Record<
    NotificationCategory,
    {
      icon: ComponentType<{ className?: string }>;
      iconClassName: string;
    }
  > = {
    approvals: {
      icon: ClipboardCheck,
      iconClassName: "bg-emerald-50 text-emerald-700"
    },
    completed: {
      icon: CheckCheck,
      iconClassName: "bg-slate-100 text-slate-700"
    },
    requests: {
      icon: FileText,
      iconClassName: "bg-orange-50 text-primary"
    },
    system: {
      icon: Bell,
      iconClassName: "bg-blue-50 text-blue-700"
    }
  };

  return tones[category];
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.floor(diffHours / 24)}d ago`;
}
