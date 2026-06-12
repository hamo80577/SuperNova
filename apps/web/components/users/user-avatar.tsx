"use client";

import { UserRound } from "lucide-react";

import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { getInitials } from "./users-display-utils";

type AvatarSize = "sm" | "md" | "lg";
type AvatarStatusTone = "active" | "pending" | "resigned";

const roleTone: Record<UserRole, string> = {
  PICKER: "bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] ring-[#FFD8BD]",
  CHAMP: "bg-[color:var(--sn-sunken)] text-[color:var(--tlb-purple)] ring-[color:var(--sn-border)]",
  AREA_MANAGER: "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)] ring-[oklch(0.88_0.06_150)]",
  ADMIN: "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)] ring-[color:var(--sn-border)]",
  SUPER_ADMIN: "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)] ring-[color:var(--sn-border)]"
};

const statusDot: Record<SafeUser["employmentStatus"], string> = {
  ACTIVE: "bg-[oklch(0.58_0.13_150)]",
  ARCHIVED: "bg-[color:var(--sn-muted)]",
  NEW_HIRE_PENDING: "bg-[oklch(0.62_0.13_70)]",
  RESIGNED: "bg-[oklch(0.55_0.19_27)]"
};

const operationalStatusDot: Record<AvatarStatusTone, string> = {
  active: "bg-[oklch(0.58_0.13_150)]",
  pending: "bg-[oklch(0.62_0.13_70)]",
  resigned: "bg-[oklch(0.55_0.19_27)]"
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
      ? "bg-[color:var(--sn-muted)]"
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
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--sn-card)]",
            dotClass
          )}
        />
      ) : null}
    </div>
  );
}
