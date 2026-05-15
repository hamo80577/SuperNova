"use client";

import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  Loader2
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatNotificationLabel,
  isQuickApproveEligible,
  type NotificationGroup
} from "@/lib/notifications/view-model";
import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  getNotificationTone
} from "./dashboard-shell-utils";

export function DashboardNotificationsMenu({
  activeAction,
  error,
  groups,
  loading,
  onOpenGroup,
  onQuickApprove,
  unreadCount
}: {
  activeAction: string | null;
  error: string | null;
  groups: NotificationGroup[];
  loading: boolean;
  onOpenGroup: (group: NotificationGroup) => void;
  onQuickApprove: (group: NotificationGroup) => void;
  unreadCount: number;
}) {
  return (
    <div
      className="absolute right-[-3rem] top-12 w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_50px_rgba(15,23,42,0.16)] sm:right-0"
      role="menu"
    >
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Notifications</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {unreadCount ? `${unreadCount} unread updates` : "No unread updates"}
          </p>
        </div>
        <Badge
          className="border-orange-200 bg-orange-50 text-orange-700"
          variant="outline"
        >
          Unread first
        </Badge>
      </div>

      {error ? (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
            Loading updates...
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <NotificationPreviewCard
              activeAction={activeAction}
              group={group}
              key={group.id}
              onOpen={() => onOpenGroup(group)}
              onQuickApprove={() => onQuickApprove(group)}
            />
          ))
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <Bell className="mb-2 h-5 w-5 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">No notifications</p>
            <p className="mt-1 text-xs text-slate-500">
              Workflow updates will appear here.
            </p>
          </div>
        )}
      </div>

      <Link
        className={buttonVariants({
          className:
            "mt-3 h-11 w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50",
          variant: "outline"
        })}
        href="/notifications"
        prefetch
      >
        <CheckCheck className="mr-2 h-4 w-4 text-primary" />
        Open notification center
      </Link>
    </div>
  );
}

function NotificationPreviewCard({
  activeAction,
  group,
  onOpen,
  onQuickApprove
}: {
  activeAction: string | null;
  group: NotificationGroup;
  onOpen: () => void;
  onQuickApprove: () => void;
}) {
  const tone = getNotificationTone(group.category);
  const Icon = tone.icon;
  const isOpening = activeAction === group.id;
  const isApproving = activeAction === `approve:${group.id}`;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border bg-white p-2.5 transition-colors",
        group.unreadCount
          ? "border-orange-200 bg-orange-50/35"
          : "border-slate-100"
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone.iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <button
        className="min-w-0 flex-1 text-left"
        disabled={Boolean(activeAction)}
        onClick={onOpen}
        type="button"
      >
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {group.latest.title}
          </p>
          {group.unreadCount ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {group.unreadCount}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
          {group.latest.body}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>{formatNotificationLabel(group.latest.type)}</span>
          <span>{formatRelativeTime(group.latest.createdAt)}</span>
          {group.items.length > 1 ? <span>{group.items.length} updates</span> : null}
        </div>
      </button>
      <div className="grid gap-1">
        {isQuickApproveEligible(group) ? (
          <Button
            aria-label="Quick approve"
            className="h-9 w-9 rounded-xl border-emerald-200 bg-emerald-50 p-0 text-emerald-700 hover:bg-emerald-100"
            disabled={Boolean(activeAction)}
            onClick={onQuickApprove}
            type="button"
            variant="outline"
          >
            {isApproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        <Button
          aria-label="Open notification target"
          className="h-9 w-9 rounded-xl border-slate-200 p-0 text-slate-600 hover:bg-slate-50"
          disabled={Boolean(activeAction)}
          onClick={onOpen}
          type="button"
          variant="outline"
        >
          {isOpening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
