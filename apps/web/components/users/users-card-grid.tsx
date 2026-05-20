"use client";

import { Building2, Network } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import type { UsersActionHandlers } from "./users-actions-menu";
import { UsersActionsMenu } from "./users-actions-menu";
import type { UsersAreaItem } from "./users-area-types";
import {
  formatEnum,
  getContextNote,
  getItemBranch,
  getItemChainName
} from "./users-display-utils";

export function UsersCardGrid({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <UserCard
          actions={actions}
          item={item}
          key={item.key}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </section>
  );
}

function UserCard({
  actions,
  item,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  item: UsersAreaItem;
  onOpenProfile: (id: string) => void;
}) {
  const branch = getItemBranch(item);
  const chainName = getItemChainName(item);

  return (
    <article
      className="group grid h-[282px] cursor-pointer grid-rows-[auto_58px_1fr] gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      onClick={() => onOpenProfile(item.user.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenProfile(item.user.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-h-[56px] min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <UserAvatar
            accountStatus={item.user.accountStatus}
            employmentStatus={item.user.employmentStatus}
            name={item.user.nameEn}
            role={item.user.role}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {item.user.nameEn}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {item.user.phoneNumber}
            </p>
          </div>
        </div>

        <UsersActionsMenu {...actions} item={item} />
      </div>

      <div className="flex min-h-0 flex-wrap content-start gap-1.5 overflow-hidden">
        <Badge
          className="rounded-full border-orange-200 bg-orange-50 text-orange-700"
          variant="outline"
        >
          {formatEnum(item.user.role)}
        </Badge>
        <UserStatusPill status={item.user.employmentStatus} />
        <Badge className="rounded-full" variant="muted">
          {formatEnum(item.user.accountStatus)}
        </Badge>
      </div>

      <div className="grid min-h-0 gap-2 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold uppercase text-slate-400">
            {getContextNote(item)}
          </p>
          {item.assignment?.status ? (
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
              {formatEnum(item.assignment.status)}
            </span>
          ) : null}
        </div>
        {branch ? (
          <ContextLine
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Branch"
            value={branch.vendorName}
          />
        ) : null}
        {chainName ? (
          <ContextLine
            icon={<Network className="h-3.5 w-3.5" />}
            label="Chain"
            value={chainName}
          />
        ) : null}
        {!branch && !chainName ? (
          <p className="line-clamp-2 text-sm text-slate-500">
            Assignment context is available inside the profile.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ContextLine({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
        {icon}
      </span>
      <span className="shrink-0 text-xs font-semibold uppercase text-slate-400">
        {label}
      </span>
      <span className="min-w-0 truncate font-medium text-slate-800">{value}</span>
    </div>
  );
}

function UserStatusPill({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        status === "ACTIVE" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "NEW_HIRE_PENDING" &&
          "border-amber-200 bg-amber-50 text-amber-700",
        (status === "RESIGNED" || status === "ARCHIVED") &&
          "border-red-200 bg-red-50 text-red-700"
      )}
      variant="outline"
    >
      {formatEnum(status)}
    </Badge>
  );
}
