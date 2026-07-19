"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown, X } from "lucide-react";

import { SnLogo, SnMark } from "@/components/sn/sn-brand";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { DashboardNav, type DashboardNavSection } from "./dashboard-nav";
import { DashboardUserMenu } from "./dashboard-user-menu";

const ROLE_LABELS: Record<UserRole, string> = {
  PICKER: "Picker",
  CHAMP: "Champ",
  AREA_MANAGER: "Area Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin"
};

type SidebarUser = {
  nameEn?: string | null;
  phoneNumber?: string | null;
  role: UserRole;
} | null | undefined;

type AccountMenuProps = {
  user?: SidebarUser;
  onLogout?: () => void;
  userMenuOpen?: boolean;
  onToggleUserMenu?: () => void;
  onCloseUserMenu?: () => void;
};

export function DashboardSidebar({
  collapsed,
  navSections,
  onNavigate,
  onToggleCollapsed,
  pathname,
  unreadCount = 0,
  userName,
  userRole,
  userInitials,
  user,
  onLogout,
  userMenuOpen = false,
  onToggleUserMenu,
  onCloseUserMenu
}: {
  collapsed: boolean;
  navSections: DashboardNavSection[];
  onNavigate?: () => void;
  onToggleCollapsed: () => void;
  pathname: string;
  unreadCount?: number;
  userName?: string | null;
  userRole?: UserRole;
  userInitials: string;
} & AccountMenuProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[80] hidden shrink-0 border-r border-[color:var(--sn-border)] bg-white transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-[76px]" : "w-[266px]"
      )}
    >
      <SidebarHeader collapsed={collapsed} />
      <DashboardNav
        collapsed={collapsed}
        navSections={navSections}
        onNavigate={onNavigate}
        pathname={pathname}
        unreadCount={unreadCount}
      />
      <SidebarFooter
        collapsed={collapsed}
        onCloseUserMenu={onCloseUserMenu}
        onLogout={onLogout}
        onToggleUserMenu={onToggleUserMenu}
        user={user}
        userInitials={userInitials}
        userMenuOpen={userMenuOpen}
        userName={userName}
        userRole={userRole}
      />
      <Button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-5 bottom-7 z-10 h-10 w-10 rounded-full border-[color:var(--sn-border)] bg-white p-0 text-[color:var(--sn-muted)] shadow-[0_12px_30px_rgba(65,21,23,0.14)] transition hover:border-primary/30 hover:bg-white hover:text-primary focus-visible:ring-primary/30"
        onClick={onToggleCollapsed}
        type="button"
        variant="outline"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </aside>
  );
}

export function MobileDashboardNavDrawer({
  navSections,
  onClose,
  onNavigate = onClose,
  open,
  pathname,
  unreadCount = 0,
  userName,
  userRole,
  userInitials
}: {
  navSections: DashboardNavSection[];
  onClose: () => void;
  onNavigate?: () => void;
  open: boolean;
  pathname: string;
  unreadCount?: number;
  userName?: string | null;
  userRole?: UserRole;
  userInitials: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Close navigation"
        className="absolute inset-0 bg-[#2e1516]/35"
        onClick={onClose}
        type="button"
      />
      <aside className="relative flex h-dvh w-[min(318px,88vw)] flex-col overflow-hidden border-r border-[color:var(--sn-border)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--sn-border)] p-4">
          <SidebarHeader collapsed={false} compact />
          <Button
            aria-label="Close navigation"
            className="h-11 w-11 rounded-xl text-[color:var(--sn-muted)]"
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <DashboardNav
          collapsed={false}
          navSections={navSections}
          onNavigate={onNavigate}
          pathname={pathname}
          unreadCount={unreadCount}
        />
        <SidebarFooter
          collapsed={false}
          userInitials={userInitials}
          userName={userName}
          userRole={userRole}
        />
      </aside>
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
  const logoSize = compact ? 36 : 42;
  const logoType = compact ? 19 : 24;

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "p-0" : "justify-center px-4 pb-5 pt-8",
        collapsed && !compact && "px-3"
      )}
    >
      {collapsed && !compact ? (
        <SnMark size={36} />
      ) : (
        <SnLogo size={logoSize} type={logoType} />
      )}
    </div>
  );
}

function SidebarFooter({
  collapsed,
  userInitials,
  userName,
  userRole,
  user,
  onLogout,
  userMenuOpen = false,
  onToggleUserMenu,
  onCloseUserMenu
}: {
  collapsed: boolean;
  userInitials: string;
  userName?: string | null;
  userRole?: UserRole;
} & AccountMenuProps) {
  const roleLabel = userRole ? ROLE_LABELS[userRole] : null;
  const interactive = Boolean(onToggleUserMenu && onLogout);

  const cardInner = (
    <>
      <span className="sn-avatar">{userInitials}</span>
      {!collapsed ? (
        <div className="grid min-w-0 flex-1 gap-0 text-left">
          <span className="truncate text-[12px] font-semibold text-[color:var(--sn-ink)]">
            {userName ?? "SuperNova user"}
          </span>
          {roleLabel ? (
            <span className="truncate text-[10.5px] text-[color:var(--sn-muted)]">
              {roleLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {!collapsed && interactive ? (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--sn-faint)]" />
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "mt-auto grid gap-2.5 border-t border-[color:var(--sn-border)]",
        collapsed ? "px-2 py-3" : "px-3 py-3"
      )}
    >
      <div className="relative">
        {interactive ? (
          <>
            {userMenuOpen ? (
              <>
                <button
                  aria-label="Close account menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={onCloseUserMenu}
                  type="button"
                />
                <div className="relative z-50">
                  <DashboardUserMenu
                    onLogout={onLogout!}
                    placement="sidebar"
                    user={user}
                    userInitials={userInitials}
                  />
                </div>
              </>
            ) : null}
            <button
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="Open account menu"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[10px] p-1 transition-colors hover:bg-[color:var(--sn-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                collapsed && "justify-center"
              )}
              onClick={onToggleUserMenu}
              type="button"
            >
              {cardInner}
            </button>
          </>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2.5 p-1",
              collapsed && "justify-center"
            )}
          >
            {cardInner}
          </div>
        )}
      </div>
    </div>
  );
}
