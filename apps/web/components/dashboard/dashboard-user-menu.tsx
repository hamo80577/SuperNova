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
  user,
  userInitials
}: {
  onLogout: () => void;
  user: DashboardMenuUser;
  userInitials: string;
}) {
  return (
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
