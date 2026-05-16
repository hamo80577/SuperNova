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
  isScrolled,
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
  isScrolled: boolean;
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
        "fixed left-0 right-0 top-0 z-[70] overflow-visible border-b px-4 backdrop-blur-xl backdrop-saturate-150 transition-[height,left,background-color,box-shadow,border-color] duration-300 ease-out sm:px-5 lg:px-6 motion-reduce:transition-none",
        isScrolled
          ? "h-16 border-slate-200/70 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.07)]"
          : "h-[84px] border-transparent bg-white/80 shadow-none",
        isCollapsed ? "lg:left-[76px]" : "lg:left-[266px]"
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 -bottom-8 h-8 bg-gradient-to-b from-white/85 via-slate-100/45 to-transparent transition-opacity duration-300 ease-out",
          isScrolled ? "opacity-100" : "opacity-70"
        )}
      />
      <div className="relative z-10 flex h-full items-center justify-between gap-3">
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
              <h1
                className={cn(
                  "truncate font-semibold tracking-normal text-slate-800 transition-[font-size,line-height,opacity,transform] duration-300 ease-out will-change-transform motion-reduce:transition-none",
                  isScrolled
                    ? "translate-y-0 text-lg leading-6 opacity-95 sm:text-xl sm:leading-7"
                    : "translate-y-[1px] text-[28px] leading-8 opacity-100 sm:text-[34px] sm:leading-10"
                )}
              >
                {title}
              </h1>
            </div>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 max-h-10 text-xs leading-5 text-slate-500 transition-[opacity,max-height] duration-200 sm:text-sm",
                isScrolled && "max-h-0 overflow-hidden opacity-0"
              )}
            >
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
