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
    <section className="overflow-visible rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
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
        <thead className="bg-[#FBF9F5] text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
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
        <tbody className="divide-y divide-[color:var(--sn-border)]">
          {items.map((item) => (
            <tr
              className="group cursor-pointer transition hover:bg-[#FDF8F2]"
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
                    className="rounded-full border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                    variant="outline"
                  >
                    {formatEnum(item.user.role)}
                  </Badge>
                </td>
              ) : null}
              <td className="px-3 py-3">
                <p className="truncate font-medium text-[color:var(--sn-body)]">
                  {getItemBranch(item)?.vendorName ?? "Open profile"}
                </p>
                {item.assignment?.startDate ? (
                  <p className="mt-1 truncate text-xs text-[color:var(--sn-muted)]">
                    Since {formatShortDate(item.assignment.startDate)}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-3">
                <p className="truncate text-[color:var(--sn-body)]">
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
    <div className="divide-y divide-[color:var(--sn-border)] lg:hidden">
      {items.map((item) => (
        <article
          className="grid cursor-pointer gap-3 p-3 transition hover:bg-[#FDF8F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--tlb-orange)]"
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

          <div className="grid gap-2 rounded-2xl bg-[color:var(--sn-sunken)] p-3">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
                Branch
              </span>
              <span className="min-w-0 truncate font-medium text-[color:var(--sn-body)]">
                {getItemBranch(item)?.vendorName ?? "Open profile"}
              </span>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
                Chain
              </span>
              <span className="min-w-0 truncate text-[color:var(--sn-body)]">
                {getItemChainName(item) || "Not assigned"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {showRoleColumn ? (
                <Badge
                  className="rounded-full border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
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
        <p className="truncate font-semibold text-[color:var(--sn-ink)]">{item.user.nameEn}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--sn-muted)]">
          {item.user.phoneNumber}
        </p>
      </div>
    </div>
  );
}

function PhoneCell({ item }: { item: UsersAreaItem }) {
  return (
    <div
      className="flex min-w-0 items-center text-xs text-[color:var(--sn-muted)]"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[color:var(--sn-sunken)] px-2 py-1">
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
          "border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        status.tone === "pending" &&
          "border-[oklch(0.88_0.08_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]",
        status.tone === "resigned" && "border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
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
