"use client";

import { Hash, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import type { UsersActionHandlers } from "./users-actions-menu";
import { UsersActionsMenu } from "./users-actions-menu";
import type { UsersAreaItem } from "./users-area-types";
import {
  formatEnum,
  getItemBranch,
  getItemChainName,
  getSafeUserIds
} from "./users-display-utils";

export function UsersTableView({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
}) {
  return (
    <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      <DesktopUsersTable
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
      />
      <MobileUsersRows
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}

function DesktopUsersTable({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
}) {
  return (
    <div className="hidden overflow-visible lg:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="w-[23%] px-4 py-3">User</th>
            <th className="w-[10%] px-3 py-3">Role</th>
            <th className="w-[16%] px-3 py-3">Assignment/Branch</th>
            <th className="w-[14%] px-3 py-3">Chain</th>
            <th className="w-[13%] px-3 py-3">Status</th>
            <th className="w-[16%] px-3 py-3">Phone/IDs</th>
            <th className="w-[8%] px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr
              className="group cursor-pointer transition hover:bg-orange-50/30"
              key={item.key}
              onClick={() => onOpenProfile(item.user.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenProfile(item.user.id);
                }
              }}
              tabIndex={0}
            >
              <td className="px-4 py-3">
                <UserCell item={item} />
              </td>
              <td className="px-3 py-3">
                <Badge
                  className="rounded-full border-orange-200 bg-orange-50 text-orange-700"
                  variant="outline"
                >
                  {formatEnum(item.user.role)}
                </Badge>
              </td>
              <td className="px-3 py-3">
                <p className="truncate font-medium text-slate-800">
                  {getItemBranch(item)?.vendorName ?? "Open profile"}
                </p>
                {item.assignment?.startDate ? (
                  <p className="mt-1 truncate text-xs text-slate-500">
                    Since {formatShortDate(item.assignment.startDate)}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-3">
                <p className="truncate text-slate-700">
                  {getItemChainName(item) || "Not assigned"}
                </p>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill status={item.user.employmentStatus} />
                  <Badge className="rounded-full" variant="muted">
                    {formatEnum(item.user.accountStatus)}
                  </Badge>
                </div>
              </td>
              <td className="px-3 py-3">
                <PhoneIdsCell item={item} />
              </td>
              <td className="px-3 py-3 text-right">
                <UsersActionsMenu {...actions} align="left" item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileUsersRows({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-slate-100 lg:hidden">
      {items.map((item) => (
        <article
          className="grid cursor-pointer gap-3 p-3 transition hover:bg-orange-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500"
          key={item.key}
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
          <div className="flex min-w-0 items-start justify-between gap-3">
            <UserCell item={item} />
            <UsersActionsMenu {...actions} item={item} />
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Branch
              </span>
              <span className="min-w-0 truncate font-medium text-slate-800">
                {getItemBranch(item)?.vendorName ?? "Open profile"}
              </span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-slate-400">
                Chain
              </span>
              <span className="min-w-0 truncate text-slate-700">
                {getItemChainName(item) || "Not assigned"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                className="rounded-full border-orange-200 bg-orange-50 text-orange-700"
                variant="outline"
              >
                {formatEnum(item.user.role)}
              </Badge>
              <StatusPill status={item.user.employmentStatus} />
              <Badge className="rounded-full" variant="muted">
                {formatEnum(item.user.accountStatus)}
              </Badge>
            </div>
          </div>

          <PhoneIdsCell item={item} />
        </article>
      ))}
    </div>
  );
}

function UserCell({ item }: { item: UsersAreaItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        accountStatus={item.user.accountStatus}
        employmentStatus={item.user.employmentStatus}
        name={item.user.nameEn}
        role={item.user.role}
        size="sm"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-950">{item.user.nameEn}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.user.phoneNumber}
        </p>
      </div>
    </div>
  );
}

function PhoneIdsCell({ item }: { item: UsersAreaItem }) {
  const ids = getSafeUserIds(item.user);

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
        <Phone className="h-3.5 w-3.5" />
        <span className="truncate">{item.user.phoneNumber}</span>
      </span>
      {ids.shopperId ? <SmallCopyPill label="Shopper" value={ids.shopperId} /> : null}
      {ids.ibsId ? <SmallCopyPill label="IBS" value={ids.ibsId} /> : null}
    </div>
  );
}

function SmallCopyPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
      <Hash className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="max-w-[80px] truncate text-slate-700">{value}</span>
      <CopyButton
        aria-label={`Copy ${label} ID`}
        className="h-6 w-6 rounded-md border-0 bg-slate-50 p-0 shadow-none"
        iconOnly
        size="sm"
        text={value}
      />
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
