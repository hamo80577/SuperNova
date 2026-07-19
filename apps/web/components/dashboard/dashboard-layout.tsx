"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { approvalsApi } from "@/lib/api/approvals";
import type { UserRole } from "@/lib/auth/types";
import {
  notificationsApi,
  type NotificationItem
} from "@/lib/api/notifications";
import { pushRoute } from "@/lib/navigation";
import {
  groupNotifications,
  isQuickApproveEligible,
  sortNotificationGroups,
  type NotificationGroup
} from "@/lib/notifications/view-model";
import { cn } from "@/lib/utils";
import { DashboardBottomNav } from "./dashboard-bottom-nav";
import { DashboardHeader } from "./dashboard-header";
import {
  getUserInitials,
  groupNavItems
} from "./dashboard-shell-utils";
import {
  DashboardSidebar,
  MobileDashboardNavDrawer
} from "./dashboard-sidebar";
import { roleNavigation } from "./role-nav";

export function DashboardLayout({
  children,
  description,
  hideHeaderDescription = false,
  showPageTitle = false,
  title
}: {
  children: ReactNode;
  description: string;
  hideHeaderDescription?: boolean;
  showPageTitle?: boolean;
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>(
    []
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [activeNotificationAction, setActiveNotificationAction] = useState<
    string | null
  >(null);
  const previousPathnameRef = useRef(pathname);
  const userInitials = getUserInitials(user?.nameEn);
  const notificationGroups = useMemo(
    () => sortNotificationGroups(groupNotifications(notificationItems)).slice(0, 5),
    [notificationItems]
  );
  const breadcrumbs = useMemo(
    () => buildDashboardBreadcrumbs(pathname, title, user?.role ?? "ADMIN"),
    [pathname, title, user?.role]
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

  const closeNavigationAfterPageChange = useCallback(() => {
    window.localStorage.setItem("supernova-sidebar-collapsed", "true");
    setIsMobileNavOpen(false);
    setIsCollapsed(true);
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
  }, []);

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

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }

    setIsScrolled(false);
  }, [pathname]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    closeNavigationAfterPageChange();
  }, [closeNavigationAfterPageChange, pathname]);

  const updateScrolled = useCallback(() => {
    setIsScrolled((contentRef.current?.scrollTop ?? window.scrollY) > 8);
  }, []);

  return (
    <main className="min-h-dvh overflow-hidden bg-white text-foreground">
      <div className="min-h-dvh lg:flex">
        <DashboardSidebar
          collapsed={isCollapsed}
          navSections={navSections}
          onCloseUserMenu={() => setIsUserMenuOpen(false)}
          onLogout={() => {
            setIsUserMenuOpen(false);
            void logout();
          }}
          onToggleCollapsed={() => setIsCollapsed((current) => !current)}
          onNavigate={closeNavigationAfterPageChange}
          onToggleUserMenu={() => {
            setIsUserMenuOpen((current) => !current);
            setIsNotificationsOpen(false);
          }}
          pathname={pathname}
          unreadCount={unreadNotificationCount}
          user={user}
          userInitials={userInitials}
          userMenuOpen={isUserMenuOpen}
          userName={user?.nameEn}
          userRole={user?.role}
        />

        <MobileDashboardNavDrawer
          navSections={navSections}
          onClose={() => setIsMobileNavOpen(false)}
          onNavigate={closeNavigationAfterPageChange}
          open={isMobileNavOpen}
          pathname={pathname}
          unreadCount={unreadNotificationCount}
          userInitials={userInitials}
          userName={user?.nameEn}
          userRole={user?.role}
        />

        <section
          className={cn(
            "min-w-0 flex-1 bg-white transition-[margin] duration-200",
            isCollapsed ? "lg:ml-[76px]" : "lg:ml-[266px]"
          )}
        >
          <DashboardHeader
            activeNotificationAction={activeNotificationAction}
            description={description}
            hideHeaderDescription={hideHeaderDescription}
            isCollapsed={isCollapsed}
            isScrolled={isScrolled}
            isNotificationsOpen={isNotificationsOpen}
            isUserMenuOpen={isUserMenuOpen}
            notificationError={notificationError}
            notificationGroups={notificationGroups}
            notificationsLoading={notificationsLoading}
            onCloseNotifications={() => setIsNotificationsOpen(false)}
            onCloseUserMenu={() => setIsUserMenuOpen(false)}
            onLoadNotificationPreview={() => void loadNotificationPreview()}
            onLogout={() => {
              setIsUserMenuOpen(false);
              void logout();
            }}
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onOpenNotificationGroup={(group) => void openNotificationGroup(group)}
            onQuickApproveNotificationGroup={(group) =>
              void quickApproveNotificationGroup(group)
            }
            onToggleNotifications={() => {
              setIsNotificationsOpen((current) => !current);
              setIsUserMenuOpen(false);
            }}
            onToggleUserMenu={() => {
              setIsUserMenuOpen((current) => !current);
              setIsNotificationsOpen(false);
            }}
            title={title}
            unreadNotificationCount={unreadNotificationCount}
            user={user}
            userInitials={userInitials}
          />
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 top-0 overflow-hidden bg-background transition-[left] duration-300 ease-out motion-reduce:transition-none",
              isCollapsed ? "lg:left-[76px]" : "lg:left-[266px]"
            )}
          >
            <div
              className="h-full overflow-y-auto overscroll-contain"
              onScroll={updateScrolled}
              ref={contentRef}
            >
              <div className="px-4 pb-24 pt-[104px] sm:px-5 sm:pt-[108px] lg:px-6 lg:pb-6 lg:pt-7">
                <DashboardBreadcrumbs items={breadcrumbs} />
                {showPageTitle ? (
                  <div className="mb-4 hidden lg:block">
                    <h1 className="sn-h1" style={{ fontSize: 22 }}>
                      {title}
                    </h1>
                    {!hideHeaderDescription ? (
                      <p className="mt-1 text-[13px] text-[color:var(--sn-muted)]">
                        {description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {children}
              </div>
            </div>
          </div>

          <DashboardBottomNav navSections={navSections} pathname={pathname} />
        </section>
      </div>
    </main>
  );
}

interface BreadcrumbItem {
  href?: string;
  label: string;
}

const workspaceBreadcrumbs: Record<
  string,
  { dashboardHref: string; label: string }
> = {
  admin: { dashboardHref: "/admin/dashboard", label: "Admin" },
  "area-manager": {
    dashboardHref: "/area-manager/dashboard",
    label: "Area Manager"
  },
  champ: { dashboardHref: "/champ/dashboard", label: "Champ" },
  picker: { dashboardHref: "/picker/dashboard", label: "Picker" }
};

const segmentLabels: Record<string, string> = {
  "annual-leave": "Annual Leave",
  "archived-users": "Archived Users",
  attendance: "Attendance",
  branches: "Branches",
  deductions: "Deductions",
  dashboard: "Dashboard",
  historical: "Historical",
  imports: "Imports",
  notifications: "Notifications",
  "operations-analysis": "Operations Analysis",
  organization: "Organization",
  "orders-kpi": "Performance",
  "orders-kpi-targets": "Orders KPI Targets",
  reports: "Reports",
  settings: "Settings",
  tickets: "Tickets",
  users: "Users"
};

function DashboardBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 min-w-0 overflow-x-auto pb-1 text-xs text-muted-foreground"
    >
      <ol className="flex min-w-max items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li className="flex items-center gap-1" key={`${item.label}-${index}`}>
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "font-medium",
                    isLast ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                  href={item.href}
                  prefetch
                >
                  {item.label}
                </Link>
              )}
              {!isLast ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function buildDashboardBreadcrumbs(
  pathname: string,
  title: string,
  fallbackRole: UserRole
): BreadcrumbItem[] {
  const segments = pathname.split("?")[0]?.split("/").filter(Boolean) ?? [];

  if (!segments.length) {
    return [];
  }

  const workspace = workspaceBreadcrumbs[segments[0]];
  const fallbackDashboardHref = dashboardHrefForRole(fallbackRole);
  const items: BreadcrumbItem[] = [];
  const segmentStart = workspace ? 1 : 0;

  items.push({
    href: workspace?.dashboardHref ?? fallbackDashboardHref,
    label: workspace?.label ?? "Dashboard"
  });

  segments.slice(segmentStart).forEach((segment, relativeIndex, tail) => {
    const segmentIndex = segmentStart + relativeIndex;
    const isLast = relativeIndex === tail.length - 1;
    const href = `/${segments.slice(0, segmentIndex + 1).join("/")}`;

    items.push({
      href: isLast ? undefined : href,
      label: isLast ? labelForLastSegment(segment, title) : labelForSegment(segment)
    });
  });

  return removeDuplicateBreadcrumbLabels(items);
}

function labelForLastSegment(segment: string, title: string) {
  if (segmentLabels[segment]) {
    return segmentLabels[segment];
  }

  return title || labelForSegment(segment);
}

function labelForSegment(segment: string) {
  return (
    segmentLabels[segment] ??
    segment
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function dashboardHrefForRole(role: UserRole) {
  if (role === "AREA_MANAGER") {
    return "/area-manager/dashboard";
  }

  if (role === "CHAMP") {
    return "/champ/dashboard";
  }

  if (role === "PICKER") {
    return "/picker/dashboard";
  }

  return "/admin/dashboard";
}

function removeDuplicateBreadcrumbLabels(items: BreadcrumbItem[]) {
  return items.filter((item, index) => item.label !== items[index - 1]?.label);
}
