"use client";

import { UserRound } from "lucide-react";

import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { getInitials } from "./users-display-utils";

type AvatarSize = "sm" | "md" | "lg";
type AvatarStatusTone = "active" | "pending" | "resigned";

const roleTone: Record<UserRole, string> = {
  PICKER: "bg-orange-50 text-orange-700 ring-orange-100",
  CHAMP: "bg-sky-50 text-sky-700 ring-sky-100",
  AREA_MANAGER: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  ADMIN: "bg-slate-100 text-slate-700 ring-slate-200",
  SUPER_ADMIN: "bg-slate-100 text-slate-700 ring-slate-200"
};

const statusDot: Record<SafeUser["employmentStatus"], string> = {
  ACTIVE: "bg-emerald-500",
  ARCHIVED: "bg-slate-400",
  NEW_HIRE_PENDING: "bg-amber-500",
  RESIGNED: "bg-red-500"
};

const operationalStatusDot: Record<AvatarStatusTone, string> = {
  active: "bg-emerald-500",
  pending: "bg-amber-500",
  resigned: "bg-red-500"
};

export function UserAvatar({
  accountStatus,
  className,
  employmentStatus = "ACTIVE",
  name,
  role,
  showStatus = true,
  size = "md",
  statusTone
}: {
  accountStatus?: SafeUser["accountStatus"];
  className?: string;
  employmentStatus?: SafeUser["employmentStatus"];
  name: string;
  role: UserRole;
  showStatus?: boolean;
  size?: AvatarSize;
  statusTone?: AvatarStatusTone;
}) {
  const initials = getInitials(name);
  const dotClass = statusTone
    ? operationalStatusDot[statusTone]
    : accountStatus === "SUSPENDED" || accountStatus === "ARCHIVED"
      ? "bg-slate-400"
      : statusDot[employmentStatus];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center rounded-2xl font-semibold ring-1",
        roleTone[role],
        size === "sm" && "h-9 w-9 text-xs",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-16 w-16 text-lg sm:h-[72px] sm:w-[72px]",
        className
      )}
    >
      {initials || <UserRound className={cn(size === "lg" ? "h-7 w-7" : "h-4 w-4")} />}
      {showStatus ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
            dotClass
          )}
        />
      ) : null}
    </div>
  );
}
