"use client";

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
  hideHeaderCopy = false,
  title
}: {
  children: ReactNode;
  description: string;
  hideHeaderCopy?: boolean;
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

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }

    setIsScrolled(false);
  }, [pathname]);

  const updateScrolled = useCallback(() => {
    setIsScrolled((contentRef.current?.scrollTop ?? window.scrollY) > 8);
  }, []);

  return (
    <main className="min-h-dvh overflow-hidden bg-white text-foreground">
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
            "min-w-0 flex-1 bg-white transition-[margin] duration-200",
            isCollapsed ? "lg:ml-[76px]" : "lg:ml-[266px]"
          )}
        >
          <DashboardHeader
            activeNotificationAction={activeNotificationAction}
            description={description}
            hideHeaderCopy={hideHeaderCopy}
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
              "fixed bottom-0 left-0 right-0 top-0 overflow-hidden bg-background transition-[left,border-radius] duration-300 ease-out motion-reduce:transition-none",
              isCollapsed ? "lg:left-[76px]" : "lg:left-[266px]",
              isScrolled
                ? "lg:rounded-tl-none"
                : "lg:rounded-tl-[28px]"
            )}
          >
            <div
              className="h-full overflow-y-auto overscroll-contain"
              onScroll={updateScrolled}
              ref={contentRef}
            >
              <div className="px-4 pb-4 pt-[104px] sm:px-5 sm:pt-[108px] lg:px-6 lg:pb-6 lg:pt-[108px]">
                {children}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
