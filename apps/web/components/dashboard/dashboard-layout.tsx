"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { approvalsApi } from "@/lib/api/approvals";
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
        <DashboardSidebar
          collapsed={isCollapsed}
          navSections={navSections}
          onToggleCollapsed={() => setIsCollapsed((current) => !current)}
          pathname={pathname}
        />

        <MobileDashboardNavDrawer
          navSections={navSections}
          onClose={() => setIsMobileNavOpen(false)}
          open={isMobileNavOpen}
          pathname={pathname}
        />

        <section
          className={cn(
            "min-w-0 flex-1 transition-[margin] duration-200",
            isCollapsed ? "lg:ml-[84px]" : "lg:ml-[286px]"
          )}
        >
          <DashboardHeader
            activeNotificationAction={activeNotificationAction}
            description={description}
            isCollapsed={isCollapsed}
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
          <div className="px-4 pb-4 pt-[92px] sm:px-5 lg:px-6 lg:pb-6">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
