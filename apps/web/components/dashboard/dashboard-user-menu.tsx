"use client";

import { CircleHelp, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/auth/role-redirects";
import type { UserRole } from "@/lib/auth/types";

type DashboardMenuUser = {
  nameEn?: string | null;
  phoneNumber?: string | null;
  role: UserRole;
} | null | undefined;

export function DashboardUserMenu({
  onLogout,
  placement = "header",
  user,
  userInitials
}: {
  onLogout: () => void;
  placement?: "header" | "sidebar";
  user: DashboardMenuUser;
  userInitials: string;
}) {
  return (
    <div
      className={
        placement === "sidebar"
          ? "absolute bottom-[calc(100%+8px)] left-0 w-[min(260px,calc(100vw-2rem))] rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-3 text-left shadow-[0_18px_50px_rgba(65,21,23,0.16)]"
          : "absolute right-0 top-12 w-[min(280px,calc(100vw-2rem))] rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-3 text-left shadow-[0_18px_50px_rgba(65,21,23,0.16)]"
      }
      role="menu"
    >
      <div className="flex items-start gap-3 rounded-xl bg-[color:var(--sn-sunken)] p-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--tlb-burgundy)] text-sm font-semibold text-white">
          {userInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
            {user?.nameEn ?? "SuperNova user"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[color:var(--sn-muted)]">
            {user?.phoneNumber ?? "No phone number"}
          </p>
          <Badge
            className="mt-2 border-brand-soft bg-primary/10 text-primary"
            variant="outline"
          >
            {user ? getRoleLabel(user.role) : "Admin"}
          </Badge>
        </div>
      </div>

      <div className="my-3 h-px bg-[color:var(--sn-border)]" />

      <div className="flex items-start gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CircleHelp className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
            SuperNova Help
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[color:var(--sn-muted)]">
            Workspace support and operational guidance.
          </p>
        </div>
      </div>

      <Button
        className="mt-3 h-11 w-full justify-start rounded-xl border-[color:var(--sn-border)] text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)]"
        onClick={onLogout}
        type="button"
        variant="outline"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}
