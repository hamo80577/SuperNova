"use client";

import { ArrowRightLeft, MinusCircle, MoreHorizontal, UserMinus } from "lucide-react";
import type { ReactNode } from "react";

import {
  getAllowedDeductionTargetRoles,
  isDeductionTargetRole
} from "@/lib/api/deductions";
import type { ResignationTargetRole } from "@/lib/api/requests";
import type { UserSummary } from "@/lib/api/workspaces";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import type { UsersAreaItem } from "./users-area-types";

export { getAllowedDeductionTargetRoles, isDeductionTargetRole };

export type UsersActionHandlers = {
  activeMenuKey: string | null;
  onOpenDeduction: (item: UsersAreaItem) => void;
  onOpenResignation: (user: UserSummary | SafeUser) => void;
  onOpenTransfer: (item: UsersAreaItem) => void;
  onToggleMenu: (key: string) => void;
  viewerRole?: UserRole;
};

export function UsersActionsMenu({
  activeMenuKey,
  align = "right",
  item,
  onOpenDeduction,
  onOpenResignation,
  onOpenTransfer,
  onToggleMenu,
  viewerRole
}: UsersActionHandlers & {
  align?: "right" | "left";
  item: UsersAreaItem;
}) {
  const allowedResignationRoles = getAllowedResignationTargetRoles(viewerRole);
  const allowedDeductionRoles = getAllowedDeductionTargetRoles(viewerRole);
  const canTransfer = item.user.role === "PICKER";
  const canResign =
    isResignationTargetRole(item.user.role) &&
    allowedResignationRoles.includes(item.user.role);
  const canDeduct =
    isDeductionTargetRole(item.user.role) &&
    allowedDeductionRoles.includes(item.user.role);
  const menuOpen = activeMenuKey === item.key;

  if (!canTransfer && !canResign && !canDeduct) {
    return null;
  }

  function closeMenu() {
    if (menuOpen) {
      onToggleMenu(item.key);
    }
  }

  return (
    <div
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        aria-expanded={menuOpen}
        aria-label={`Open actions for ${item.user.nameEn}`}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.98]"
        onClick={() => onToggleMenu(item.key)}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div
          className={cn(
            "absolute top-12 z-30 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl",
            "motion-safe:animate-[sn-dialog-panel-in_140ms_ease-out_both]",
            align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
          )}
        >
          {canTransfer ? (
            <MenuAction
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Transfer"
              onClick={() => {
                closeMenu();
                onOpenTransfer(item);
              }}
              tone="blue"
            />
          ) : null}
          {canDeduct ? (
            <MenuAction
              icon={<MinusCircle className="h-4 w-4" />}
              label="Add deduction"
              onClick={() => {
                closeMenu();
                onOpenDeduction(item);
              }}
              tone="amber"
            />
          ) : null}
          {canResign ? (
            <MenuAction
              icon={<UserMinus className="h-4 w-4" />}
              label="Resign"
              onClick={() => {
                closeMenu();
                onOpenResignation(item.user);
              }}
              tone="red"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  tone
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "amber" | "blue" | "red";
}) {
  return (
    <button
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        tone === "amber" && "text-amber-700 hover:bg-amber-50",
        tone === "blue" && "text-blue-700 hover:bg-blue-50",
        tone === "red" && "text-red-700 hover:bg-red-50"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

export function getAllowedResignationTargetRoles(
  role: UserRole | undefined
): ResignationTargetRole[] {
  if (role === "CHAMP") return ["PICKER"];
  if (role === "AREA_MANAGER") return ["PICKER", "CHAMP"];
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

export function isResignationTargetRole(role: UserRole): role is ResignationTargetRole {
  return role === "PICKER" || role === "CHAMP" || role === "AREA_MANAGER";
}
