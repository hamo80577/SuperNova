"use client";

import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Loader2,
  LogOut,
  Menu,
  PanelLeft,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { approvalsApi } from "@/lib/api/approvals";
import {
  notificationsApi,
  type NotificationItem
} from "@/lib/api/notifications";
import { getRoleLabel } from "@/lib/auth/role-redirects";
import type { UserRole } from "@/lib/auth/types";
import { pushRoute } from "@/lib/navigation";
import {
  formatNotificationLabel,
  groupNotifications,
  isQuickApproveEligible,
  sortNotificationGroups,
  type NotificationCategory,
  type NotificationGroup
} from "@/lib/notifications/view-model";
import { cn } from "@/lib/utils";
import { roleNavigation, type NavItem } from "./role-nav";

const dashboardCopy: Record<
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

export function DashboardShell({ role }: { role: UserRole }) {
  const copy = dashboardCopy[role];

  return (
    <DashboardFrame
      allowedRoles={role === "ADMIN" ? ["ADMIN", "SUPER_ADMIN"] : [role]}
      description={copy.description}
      title={copy.title}
    >
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              {copy.emptyTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy.emptyBody}
            </p>
          </div>
          <Badge variant="muted">MVP ready</Badge>
        </div>
        <DashboardPlaceholderGrid />
      </div>
    </DashboardFrame>
  );
}

export function DashboardFrame({
  allowedRoles,
  children,
  description,
  title
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardFrameInner description={description} title={title}>
        {children}
      </DashboardFrameInner>
    </ProtectedRoute>
  );
}

function DashboardFrameInner({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const navItems = roleNavigation[user?.role ?? "ADMIN"];
  const navSections = useMemo(() => groupNavItems(navItems), [navItems]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>(
    []
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [activeNotificationAction, setActiveNotificationAction] = useState<
    string | null
  >(null);
  const userInitials = getUserInitials(user?.nameEn);
  const notificationGroups = useMemo(
    () => sortNotificationGroups(groupNotifications(notificationItems)).slice(0, 5),
    [notificationItems]
  );

  const loadNotificationPreview = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationError(null);

    try {
      const [latest, unread] = await Promise.all([
        notificationsApi.list({ pageSize: 20 }),
        notificationsApi.list({ pageSize: 1, unreadOnly: true })
      ]);
      setNotificationItems(latest.items);
      setUnreadNotificationCount(unread.meta.total);
    } catch (caughtError) {
      setNotificationError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load notifications."
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markGroupRead = useCallback(async (group: NotificationGroup) => {
    const unreadItems = group.items.filter((item) => !item.readAt);

    if (!unreadItems.length) {
      return;
    }

    await Promise.all(
      unreadItems.map((item) => notificationsApi.markRead(item.id))
    );
  }, []);

  const openNotificationGroup = useCallback(
    async (group: NotificationGroup) => {
      setActiveNotificationAction(group.id);
      try {
        await markGroupRead(group);
        setIsNotificationsOpen(false);
        await loadNotificationPreview();
        pushRoute(router, group.targetHref);
      } catch (caughtError) {
        setNotificationError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to open notification."
        );
      } finally {
        setActiveNotificationAction(null);
      }
    },
    [loadNotificationPreview, markGroupRead, router]
  );

  const quickApproveNotificationGroup = useCallback(
    async (group: NotificationGroup) => {
      if (!group.approvalId || !isQuickApproveEligible(group)) {
        return;
      }

      setActiveNotificationAction(`approve:${group.id}`);
      try {
        await approvalsApi.approve(group.approvalId);
        await markGroupRead(group);
        await loadNotificationPreview();
      } catch (caughtError) {
        setNotificationError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to approve from notification."
        );
      } finally {
        setActiveNotificationAction(null);
      }
    },
    [loadNotificationPreview, markGroupRead]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("supernova-sidebar-collapsed");
    if (stored) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "supernova-sidebar-collapsed",
      String(isCollapsed)
    );
  }, [isCollapsed]);

  useEffect(() => {
    if (!isUserMenuOpen && !isNotificationsOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isNotificationsOpen, isUserMenuOpen]);

  useEffect(() => {
    if (user?.id) {
      void loadNotificationPreview();
    }
  }, [loadNotificationPreview, user?.id]);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f6f6f4] text-foreground">
      <div className="min-h-dvh lg:flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-[80] hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
            isCollapsed ? "w-[84px]" : "w-[286px]"
          )}
        >
          <SidebarHeader collapsed={isCollapsed} />
          <DashboardNav
            collapsed={isCollapsed}
            navSections={navSections}
            pathname={pathname}
          />
          <div className="border-t border-slate-100 p-3">
            <Button
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "h-11 w-full justify-center rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50",
                !isCollapsed && "justify-start"
              )}
              onClick={() => setIsCollapsed((current) => !current)}
              type="button"
              variant="outline"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </aside>

        {isMobileNavOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/35"
              onClick={() => setIsMobileNavOpen(false)}
              type="button"
            />
            <aside className="relative flex h-dvh w-[min(318px,88vw)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <SidebarHeader collapsed={false} compact />
                <Button
                  aria-label="Close navigation"
                  className="h-11 w-11 rounded-xl text-slate-600"
                  onClick={() => setIsMobileNavOpen(false)}
                  type="button"
                  variant="ghost"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <DashboardNav
                collapsed={false}
                navSections={navSections}
                onNavigate={() => setIsMobileNavOpen(false)}
                pathname={pathname}
              />
            </aside>
          </div>
        ) : null}

        <section
          className={cn(
            "min-w-0 flex-1 transition-[margin] duration-200",
            isCollapsed ? "lg:ml-[84px]" : "lg:ml-[286px]"
          )}
        >
          <header
            className={cn(
              "fixed left-0 right-0 top-0 z-[70] h-[76px] border-b border-slate-200/80 bg-white/95 px-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur transition-[left] duration-200 sm:px-5 lg:px-6",
              isCollapsed ? "lg:left-[84px]" : "lg:left-[286px]"
            )}
          >
            <div className="flex h-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  aria-label="Open navigation"
                  className="h-11 w-11 shrink-0 rounded-xl text-slate-700 lg:hidden"
                  onClick={() => setIsMobileNavOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <PanelLeft className="hidden h-4 w-4 text-primary sm:block lg:hidden" />
                    <h1 className="truncate text-base font-semibold tracking-normal text-slate-950 sm:text-lg">
                      {title}
                    </h1>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {isNotificationsOpen ? (
                  <button
                    aria-label="Close notifications"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsNotificationsOpen(false)}
                    type="button"
                  />
                ) : null}
                <div className="relative z-50">
                  <Button
                    aria-expanded={isNotificationsOpen}
                    aria-haspopup="menu"
                    aria-label="Open notifications"
                    className="relative h-10 w-10 rounded-xl border-slate-200 p-0 text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setIsNotificationsOpen((current) => !current);
                      setIsUserMenuOpen(false);
                      void loadNotificationPreview();
                    }}
                    type="button"
                    variant="outline"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                        {unreadNotificationCount > 9
                          ? "9+"
                          : unreadNotificationCount}
                      </span>
                    ) : null}
                  </Button>
                  {isNotificationsOpen ? (
                    <NotificationsPreviewMenu
                      activeAction={activeNotificationAction}
                      error={notificationError}
                      groups={notificationGroups}
                      loading={notificationsLoading}
                      onOpenGroup={(group) => void openNotificationGroup(group)}
                      onQuickApprove={(group) =>
                        void quickApproveNotificationGroup(group)
                      }
                      unreadCount={unreadNotificationCount}
                    />
                  ) : null}
                </div>
                {isUserMenuOpen ? (
                  <button
                    aria-label="Close user menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsUserMenuOpen(false)}
                    type="button"
                  />
                ) : null}
                <div className="relative z-50">
                  <Button
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Open user menu"
                    className="h-10 w-10 rounded-full border-slate-200 bg-slate-950 p-0 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={() => {
                      setIsUserMenuOpen((current) => !current);
                      setIsNotificationsOpen(false);
                    }}
                    type="button"
                    variant="outline"
                  >
                    {userInitials}
                  </Button>
                  {isUserMenuOpen ? (
                    <div
                      className="absolute right-0 top-12 w-[min(280px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
                      role="menu"
                    >
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                          {userInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {user?.nameEn ?? "SuperNova user"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {user?.phoneNumber ?? "No phone number"}
                          </p>
                          <Badge
                            className="mt-2 border-orange-200 bg-orange-50 text-orange-700"
                            variant="outline"
                          >
                            {user ? getRoleLabel(user.role) : "Admin"}
                          </Badge>
                        </div>
                      </div>

                      <div className="my-3 h-px bg-slate-100" />

                      <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-primary">
                          <CircleHelp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">
                            SuperNova Help
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">
                            Workspace support and operational guidance.
                          </p>
                        </div>
                      </div>

                      <Button
                        className="mt-3 h-11 w-full justify-start rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          void logout();
                        }}
                        type="button"
                        variant="outline"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
          <div className="px-4 pb-4 pt-[92px] sm:px-5 lg:px-6 lg:pb-6">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function NotificationsPreviewMenu({
  activeAction,
  error,
  groups,
  loading,
  onOpenGroup,
  onQuickApprove,
  unreadCount
}: {
  activeAction: string | null;
  error: string | null;
  groups: NotificationGroup[];
  loading: boolean;
  onOpenGroup: (group: NotificationGroup) => void;
  onQuickApprove: (group: NotificationGroup) => void;
  unreadCount: number;
}) {
  return (
    <div
      className="absolute right-[-3rem] top-12 w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:right-0"
      role="menu"
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Notifications</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {unreadCount ? `${unreadCount} unread updates` : "No unread updates"}
          </p>
        </div>
        <Badge
          className="border-orange-200 bg-orange-50 text-orange-700"
          variant="outline"
        >
          Unread first
        </Badge>
      </div>

      {error ? (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
            Loading updates...
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <NotificationPreviewCard
              activeAction={activeAction}
              group={group}
              key={group.id}
              onOpen={() => onOpenGroup(group)}
              onQuickApprove={() => onQuickApprove(group)}
            />
          ))
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <Bell className="mb-2 h-5 w-5 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">No notifications</p>
            <p className="mt-1 text-xs text-slate-500">
              Workflow updates will appear here.
            </p>
          </div>
        )}
      </div>

      <Link
        className={buttonVariants({
          className:
            "mt-3 h-11 w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50",
          variant: "outline"
        })}
        href="/notifications"
        prefetch
      >
        <CheckCheck className="mr-2 h-4 w-4 text-primary" />
        Open notification center
      </Link>
    </div>
  );
}

function NotificationPreviewCard({
  activeAction,
  group,
  onOpen,
  onQuickApprove
}: {
  activeAction: string | null;
  group: NotificationGroup;
  onOpen: () => void;
  onQuickApprove: () => void;
}) {
  const tone = getNotificationTone(group.category);
  const Icon = tone.icon;
  const isOpening = activeAction === group.id;
  const isApproving = activeAction === `approve:${group.id}`;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border bg-white p-2.5 transition-colors",
        group.unreadCount
          ? "border-orange-200 bg-orange-50/35"
          : "border-slate-100"
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone.iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <button
        className="min-w-0 flex-1 text-left"
        disabled={Boolean(activeAction)}
        onClick={onOpen}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {group.latest.title}
          </p>
          {group.unreadCount ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {group.unreadCount}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
          {group.latest.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>{formatNotificationLabel(group.latest.type)}</span>
          <span>{formatRelativeTime(group.latest.createdAt)}</span>
          {group.items.length > 1 ? <span>{group.items.length} updates</span> : null}
        </div>
      </button>
      <div className="grid gap-1">
        {isQuickApproveEligible(group) ? (
          <Button
            aria-label="Quick approve"
            className="h-9 w-9 rounded-xl border-emerald-200 bg-emerald-50 p-0 text-emerald-700 hover:bg-emerald-100"
            disabled={Boolean(activeAction)}
            onClick={onQuickApprove}
            type="button"
            variant="outline"
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        <Button
          aria-label="Open notification target"
          className="h-9 w-9 rounded-xl border-slate-200 p-0 text-slate-600 hover:bg-slate-50"
          disabled={Boolean(activeAction)}
          onClick={onOpen}
          type="button"
          variant="outline"
        >
          {isOpening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function SidebarHeader({
  collapsed,
  compact = false
}: {
  collapsed: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "p-0" : "border-b border-slate-100 p-4",
        collapsed && !compact && "justify-center px-3"
      )}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_10px_24px_rgba(255,90,0,0.18)]">
        SN
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-normal text-slate-950">
            SuperNova
          </p>
          <p className="truncate text-xs font-medium text-slate-500">
            Partner Workforce Operations
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DashboardNav({
  collapsed,
  navSections,
  onNavigate,
  pathname
}: {
  collapsed: boolean;
  navSections: Array<[string, NavItem[]]>;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
    >
      <div className="grid gap-5">
        {navSections.map(([section, items]) => (
          <div className="grid gap-1" key={section}>
            {!collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {section}
              </p>
            ) : null}
            {items.map((item) => (
              <DashboardNavItem
                collapsed={collapsed}
                item={item}
                key={`${section}-${item.label}`}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function DashboardNavItem({
  collapsed,
  item,
  onNavigate,
  pathname
}: {
  collapsed: boolean;
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = item.href ? isActiveHref(pathname, item.href) : false;
  const itemClassName = cn(
    "flex min-h-11 items-center rounded-xl border text-sm font-medium transition-colors",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    isActive
      ? "border-orange-200 bg-orange-50 text-orange-700 shadow-[inset_3px_0_0_hsl(var(--primary))]"
      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
    item.disabled && "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-slate-600"
  );

  if (!item.href || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={itemClassName}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={itemClassName}
      href={item.href}
      onClick={onNavigate}
      prefetch
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function DashboardPlaceholderGrid() {
  const { user } = useAuth();
  const navItems = roleNavigation[user?.role ?? "ADMIN"];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {navItems.slice(1).map((item) => {
        const Icon = item.icon;
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-4" key={item.label}>
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-slate-950">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.href ? "Available" : "Planned control surface"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function groupNavItems(items: NavItem[]) {
  const sections = new Map<string, NavItem[]>();

  for (const item of items) {
    const section = item.section ?? "Workspace";
    sections.set(section, [...(sections.get(section) ?? []), item]);
  }

  return Array.from(sections.entries());
}

function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getUserInitials(name?: string | null) {
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

function getNotificationTone(category: NotificationCategory): {
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

function formatRelativeTime(value: string) {
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
