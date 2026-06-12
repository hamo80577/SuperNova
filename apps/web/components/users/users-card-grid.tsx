"use client";

import { Building2, Network } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "./user-avatar";
import type { UsersActionHandlers } from "./users-actions-menu";
import { UsersActionsMenu } from "./users-actions-menu";
import type { UsersAreaItem } from "./users-area-types";
import {
  formatEnum,
  getContextNote,
  getItemBranch,
  getItemChainName,
  getUserOperationalStatus,
  type UserOperationalStatus
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
  const operationalStatus = getUserOperationalStatus(item);

  return (
    <article
      className="group grid h-[282px] cursor-pointer grid-rows-[auto_58px_1fr] gap-3 overflow-hidden rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#FFD8BD] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
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
            statusTone={operationalStatus.tone}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
              {item.user.nameEn}
            </p>
            <p className="mt-0.5 truncate text-xs text-[color:var(--sn-muted)]">
              {item.user.phoneNumber}
            </p>
          </div>
        </div>

        <UsersActionsMenu {...actions} item={item} />
      </div>

      <div className="flex min-h-0 flex-wrap content-start gap-1.5 overflow-hidden">
        <Badge
          className="rounded-full border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
          variant="outline"
        >
          {formatEnum(item.user.role)}
        </Badge>
        <StatusPill status={operationalStatus} />
      </div>

      <div className="grid min-h-0 gap-2 overflow-hidden rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
            {getContextNote(item)}
          </p>
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
          <p className="line-clamp-2 text-sm text-[color:var(--sn-muted)]">
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
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[color:var(--sn-card)] text-[color:var(--sn-muted)] ring-1 ring-[color:var(--sn-border)]">
        {icon}
      </span>
      <span className="shrink-0 text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
        {label}
      </span>
      <span className="min-w-0 truncate font-medium text-[color:var(--sn-body)]">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: UserOperationalStatus }) {
  return (
    <Badge
      className={
        status.tone === "active"
          ? "rounded-full border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]"
          : status.tone === "pending"
            ? "rounded-full border-[oklch(0.88_0.08_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]"
            : "rounded-full border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
      }
      title={status.title}
      variant="outline"
    >
      {status.label}
    </Badge>
  );
}
