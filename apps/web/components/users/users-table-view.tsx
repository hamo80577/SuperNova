"use client";

import { Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import type { UsersActionHandlers } from "./users-actions-menu";
import { UsersActionsMenu } from "./users-actions-menu";
import type { UsersAreaItem, UsersSectionId } from "./users-area-types";
import {
  formatEnum,
  getItemBranch,
  getItemChainName,
  getUserOperationalStatus,
  type UserOperationalStatus
} from "./users-display-utils";

export function UsersTableView({
  actions,
  items,
  onOpenProfile,
  section
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  section: UsersSectionId;
}) {
  const showRoleColumn = section === "management";

  return (
    <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      <DesktopUsersTable
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
        showRoleColumn={showRoleColumn}
      />
      <MobileUsersRows
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
        showRoleColumn={showRoleColumn}
      />
    </section>
  );
}

function DesktopUsersTable({
  actions,
  items,
  onOpenProfile,
  showRoleColumn
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  showRoleColumn: boolean;
}) {
  return (
    <div className="hidden overflow-visible lg:block">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className={cn("px-4 py-3", showRoleColumn ? "w-[23%]" : "w-[27%]")}>
              User
            </th>
            {showRoleColumn ? (
              <th className="w-[10%] px-3 py-3">Role</th>
            ) : null}
            <th className={cn("px-3 py-3", showRoleColumn ? "w-[16%]" : "w-[22%]")}>
              Assignment/Branch
            </th>
            <th className={cn("px-3 py-3", showRoleColumn ? "w-[14%]" : "w-[17%]")}>
              Chain
            </th>
            <th className={cn("px-3 py-3", showRoleColumn ? "w-[13%]" : "w-[15%]")}>
              Status
            </th>
            <th className={cn("px-3 py-3", showRoleColumn ? "w-[16%]" : "w-[13%]")}>
              Phone
            </th>
            <th className={cn("px-3 py-3 text-right", showRoleColumn ? "w-[8%]" : "w-[6%]")}>
              Actions
            </th>
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
              {showRoleColumn ? (
                <td className="px-3 py-3">
                  <Badge
                    className="rounded-full border-orange-200 bg-orange-50 text-orange-700"
                    variant="outline"
                  >
                    {formatEnum(item.user.role)}
                  </Badge>
                </td>
              ) : null}
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
                <OperationalStatusPill item={item} />
              </td>
              <td className="px-3 py-3">
                <PhoneCell item={item} />
              </td>
              <td className="px-3 py-3 text-right">
                <UsersActionsMenu {...actions} item={item} />
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
  onOpenProfile,
  showRoleColumn
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  showRoleColumn: boolean;
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
              {showRoleColumn ? (
                <Badge
                  className="rounded-full border-orange-200 bg-orange-50 text-orange-700"
                  variant="outline"
                >
                  {formatEnum(item.user.role)}
                </Badge>
              ) : null}
              <OperationalStatusPill item={item} />
            </div>
          </div>

          <PhoneCell item={item} />
        </article>
      ))}
    </div>
  );
}

function UserCell({ item }: { item: UsersAreaItem }) {
  const operationalStatus = getUserOperationalStatus(item);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        accountStatus={item.user.accountStatus}
        employmentStatus={item.user.employmentStatus}
        name={item.user.nameEn}
        role={item.user.role}
        size="sm"
        statusTone={operationalStatus.tone}
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

function PhoneCell({ item }: { item: UsersAreaItem }) {
  return (
    <div
      className="flex min-w-0 items-center text-xs text-slate-500"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
        <Phone className="h-3.5 w-3.5" />
        <span className="truncate">{item.user.phoneNumber}</span>
      </span>
    </div>
  );
}

function OperationalStatusPill({ item }: { item: UsersAreaItem }) {
  const status = getUserOperationalStatus(item);

  return <StatusPill status={status} />;
}

function StatusPill({ status }: { status: UserOperationalStatus }) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        status.tone === "active" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        status.tone === "pending" &&
          "border-amber-200 bg-amber-50 text-amber-700",
        status.tone === "resigned" && "border-red-200 bg-red-50 text-red-700"
      )}
      title={status.title}
      variant="outline"
    >
      {status.label}
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
