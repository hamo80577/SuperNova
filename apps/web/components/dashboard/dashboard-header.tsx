"use client";

import { Bell, Menu, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth/types";
import type { NotificationGroup } from "@/lib/notifications/view-model";
import { cn } from "@/lib/utils";
import { DashboardNotificationsMenu } from "./dashboard-notifications-menu";
import { DashboardUserMenu } from "./dashboard-user-menu";

type DashboardHeaderUser = {
  nameEn?: string | null;
  phoneNumber?: string | null;
  role: UserRole;
} | null | undefined;

export function DashboardHeader({
  activeNotificationAction,
  description,
  isCollapsed,
  isNotificationsOpen,
  isUserMenuOpen,
  notificationError,
  notificationGroups,
  notificationsLoading,
  onCloseNotifications,
  onCloseUserMenu,
  onLoadNotificationPreview,
  onLogout,
  onOpenMobileNav,
  onOpenNotificationGroup,
  onQuickApproveNotificationGroup,
  onToggleNotifications,
  onToggleUserMenu,
  title,
  unreadNotificationCount,
  user,
  userInitials
}: {
  activeNotificationAction: string | null;
  description: string;
  isCollapsed: boolean;
  isNotificationsOpen: boolean;
  isUserMenuOpen: boolean;
  notificationError: string | null;
  notificationGroups: NotificationGroup[];
  notificationsLoading: boolean;
  onCloseNotifications: () => void;
  onCloseUserMenu: () => void;
  onLoadNotificationPreview: () => void;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  onOpenNotificationGroup: (group: NotificationGroup) => void;
  onQuickApproveNotificationGroup: (group: NotificationGroup) => void;
  onToggleNotifications: () => void;
  onToggleUserMenu: () => void;
  title: string;
  unreadNotificationCount: number;
  user: DashboardHeaderUser;
  userInitials: string;
}) {
  return (
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
            onClick={onOpenMobileNav}
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
              onClick={onCloseNotifications}
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
                onToggleNotifications();
                onLoadNotificationPreview();
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
              <DashboardNotificationsMenu
                activeAction={activeNotificationAction}
                error={notificationError}
                groups={notificationGroups}
                loading={notificationsLoading}
                onOpenGroup={onOpenNotificationGroup}
                onQuickApprove={onQuickApproveNotificationGroup}
                unreadCount={unreadNotificationCount}
              />
            ) : null}
          </div>
          {isUserMenuOpen ? (
            <button
              aria-label="Close user menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={onCloseUserMenu}
              type="button"
            />
          ) : null}
          <div className="relative z-50">
            <Button
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label="Open user menu"
              className="h-10 w-10 rounded-full border-slate-200 bg-slate-950 p-0 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={onToggleUserMenu}
              type="button"
              variant="outline"
            >
              {userInitials}
            </Button>
            {isUserMenuOpen ? (
              <DashboardUserMenu
                onLogout={onLogout}
                user={user}
                userInitials={userInitials}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
