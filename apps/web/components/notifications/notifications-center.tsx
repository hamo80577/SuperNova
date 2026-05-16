"use client";

import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Inbox,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListCardSkeleton } from "@/components/ui/skeleton";
import { approvalsApi } from "@/lib/api/approvals";
import {
  notificationsApi,
  type NotificationItem
} from "@/lib/api/notifications";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";
import {
  filterNotificationGroups,
  formatNotificationLabel,
  groupNotifications,
  isQuickApproveEligible,
  sortNotificationGroups,
  type NotificationCategory,
  type NotificationFilter,
  type NotificationGroup
} from "@/lib/notifications/view-model";
import { pushRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const notificationFilters: Array<{
  label: string;
  value: NotificationFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Approvals", value: "approvals" },
  { label: "Requests", value: "requests" },
  { label: "Completed", value: "completed" }
];

function isRequestUnavailableError(caughtError: unknown) {
  const error = caughtError as { message?: string; status?: number } | null;
  return (
    error?.status === 404 ||
    Boolean(error?.message && /not found|no longer available/i.test(error.message))
  );
}

export function NotificationsCenter() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [requestDetails, setRequestDetails] = useState<
    Record<string, RequestDetail | null>
  >({});
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const groups = useMemo(
    () => sortNotificationGroups(groupNotifications(items)),
    [items]
  );
  const visibleGroups = useMemo(
    () => filterNotificationGroups(groups, activeFilter),
    [activeFilter, groups]
  );
  const unreadCount = items.filter((item) => !item.readAt).length;

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.list({ pageSize: 80 });
      setItems(response.items);
      await loadRequestDetails(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRequestDetails(notificationItems: NotificationItem[]) {
    const requestIds = Array.from(
      new Set(
        groupNotifications(notificationItems)
          .map((group) => group.requestId)
          .filter((requestId): requestId is string => Boolean(requestId))
      )
    );

    if (!requestIds.length) {
      setRequestDetails({});
      return;
    }

    const entries = await Promise.all(
      requestIds.map(async (requestId) => {
        try {
          return [requestId, await requestsApi.get(requestId)] as const;
        } catch (caughtError) {
          return isRequestUnavailableError(caughtError)
            ? ([requestId, null] as const)
            : null;
        }
      })
    );

    setRequestDetails(
      Object.fromEntries(
        entries.filter(
          (entry): entry is readonly [string, RequestDetail | null] =>
            Boolean(entry)
        )
      )
    );
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markGroupRead(group: NotificationGroup) {
    const unreadItems = group.items.filter((item) => !item.readAt);

    if (!unreadItems.length) {
      return;
    }

    await Promise.all(
      unreadItems.map((item) => notificationsApi.markRead(item.id))
    );
  }

  async function openGroup(group: NotificationGroup) {
    setActiveAction(group.id);
    try {
      await markGroupRead(group);
      await loadNotifications();
      pushRoute(router, group.targetHref);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to open notification."
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function markRead(group: NotificationGroup) {
    setActiveAction(`read:${group.id}`);
    try {
      await markGroupRead(group);
      await loadNotifications();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to mark notification read."
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function markAllRead() {
    setActiveAction("read:all");
    try {
      await notificationsApi.markAllRead();
      await loadNotifications();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to mark notifications read."
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function quickApprove(group: NotificationGroup) {
    if (!group.approvalId || !isQuickApproveEligible(group)) {
      return;
    }

    setActiveAction(`approve:${group.id}`);
    try {
      await approvalsApi.approve(group.approvalId);
      await markGroupRead(group);
      await loadNotifications();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to approve from notification."
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="grid gap-4">
      {error ? <ErrorState message={error} /> : null}

      <section className="sticky top-[81px] z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {notificationFilters.map((filter) => (
              <button
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  activeFilter === filter.value
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button
            className="h-10 shrink-0 rounded-xl border-slate-200 text-slate-700"
            disabled={Boolean(activeAction) || unreadCount === 0}
            onClick={() => void markAllRead()}
            type="button"
            variant="outline"
          >
            {activeAction === "read:all" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4 text-primary" />
            )}
            Mark all read
          </Button>
        </div>
      </section>

      {loading ? (
        <LoadingState />
      ) : visibleGroups.length ? (
        <div className="grid gap-4">
          {visibleGroups.map((group) => {
            const requestDetail = group.requestId
              ? requestDetails[group.requestId]
              : undefined;

            return (
              <NotificationGroupCard
                activeAction={activeAction}
                expanded={expandedGroupId === group.id}
                group={group}
                key={group.id}
                onMarkRead={() => void markRead(group)}
                onOpen={() => void openGroup(group)}
                onQuickApprove={() => void quickApprove(group)}
                onToggleExpanded={() =>
                  setExpandedGroupId((current) =>
                    current === group.id ? null : group.id
                  )
                }
                request={requestDetail ?? undefined}
                requestUnavailable={Boolean(
                  group.requestId &&
                    Object.prototype.hasOwnProperty.call(
                      requestDetails,
                      group.requestId
                    ) &&
                    requestDetail === null
                )}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function NotificationGroupCard({
  activeAction,
  expanded,
  group,
  onMarkRead,
  onOpen,
  onQuickApprove,
  onToggleExpanded,
  request,
  requestUnavailable
}: {
  activeAction: string | null;
  expanded: boolean;
  group: NotificationGroup;
  onMarkRead: () => void;
  onOpen: () => void;
  onQuickApprove: () => void;
  onToggleExpanded: () => void;
  request?: RequestDetail;
  requestUnavailable: boolean;
}) {
  const tone = getNotificationTone(group.category);
  const Icon = tone.icon;
  const isOpening = activeAction === group.id;
  const isReading = activeAction === `read:${group.id}`;
  const isApproving = activeAction === `approve:${group.id}`;
  const isStacked = group.items.length > 1;
  const actionCompleted = isActionCompleted(group, request);
  const subject = getRequestSubject(request);
  const previewBody = requestUnavailable
    ? "Request no longer available."
    : subject
    ? `${formatNotificationLabel(request?.type ?? group.latest.type)} - ${subject}`
    : group.latest.body;

  return (
    <div className="relative pt-1">
      {!expanded && isStacked ? (
        <StackLayers count={group.items.length} unread={group.unreadCount > 0} />
      ) : null}
      <section
        className={cn(
          "relative z-10 rounded-[22px] border bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-colors sm:p-4",
          group.unreadCount
            ? "border-orange-200 ring-1 ring-orange-100"
            : "border-slate-200"
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <button
            className="flex min-w-0 flex-1 gap-3 text-left"
            disabled={Boolean(activeAction)}
            onClick={isStacked ? onToggleExpanded : onOpen}
            type="button"
          >
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-[18px]",
                tone.iconClassName
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={group.unreadCount ? "default" : "muted"}>
                  {group.unreadCount ? `${group.unreadCount} unread` : "Read"}
                </Badge>
                {actionCompleted ? (
                  <Badge
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                    variant="outline"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Done
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  {formatNotificationLabel(group.latest.type)}
                </Badge>
                {isStacked ? (
                  <Badge variant="outline">{group.items.length} stacked</Badge>
                ) : null}
                {requestUnavailable ? (
                  <Badge
                    className="border-slate-200 bg-slate-50 text-slate-600"
                    variant="outline"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Unavailable
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-2 text-base font-semibold tracking-normal text-slate-950">
                {group.latest.title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {previewBody}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Latest update {formatDateTime(group.latest.createdAt)}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            {isStacked ? (
              <Button
                aria-label={expanded ? "Collapse updates" : "Expand updates"}
                className="h-10 rounded-xl border-slate-200 px-3 text-slate-700"
                disabled={Boolean(activeAction)}
                onClick={onToggleExpanded}
                type="button"
                variant="outline"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4 sm:mr-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">
                  {expanded ? "Collapse" : "Expand"}
                </span>
              </Button>
            ) : null}
            {isQuickApproveEligible(group) && !actionCompleted ? (
              <Button
                className="h-10 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-700 hover:bg-emerald-100"
                disabled={Boolean(activeAction)}
                onClick={onQuickApprove}
                type="button"
                variant="outline"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Check className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Quick approve</span>
              </Button>
            ) : null}
            {group.unreadCount ? (
              <Button
                className="h-10 rounded-xl border-slate-200 px-3 text-slate-700"
                disabled={Boolean(activeAction)}
                onClick={onMarkRead}
                type="button"
                variant="outline"
              >
                {isReading ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <CheckCheck className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Mark read</span>
              </Button>
            ) : null}
            <Button
              className="h-10 rounded-xl px-3"
              disabled={Boolean(activeAction)}
              onClick={onOpen}
              type="button"
            >
              {isOpening ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Open</span>
            </Button>
          </div>
        </div>

        {expanded && isStacked ? (
          <button
            className="mt-4 grid w-full gap-2 border-t border-slate-100 pt-4 text-left"
            onClick={onToggleExpanded}
            type="button"
          >
            {group.items.map((item, index) => (
              <div
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                key={item.id}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    item.readAt
                      ? "bg-white text-slate-500"
                      : "bg-orange-100 text-orange-700"
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </button>
        ) : null}
      </section>
    </div>
  );
}

function StackLayers({ count, unread }: { count: number; unread: boolean }) {
  const layerCount = Math.min(count - 1, 3);

  return (
    <>
      {Array.from({ length: layerCount }).map((_, index) => (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-x-3 h-full rounded-[22px] border bg-white shadow-sm",
            unread ? "border-orange-100" : "border-slate-200"
          )}
          key={index}
          style={{
            top: `${8 + index * 7}px`,
            zIndex: index
          }}
        />
      ))}
    </>
  );
}

function isActionCompleted(group: NotificationGroup, request?: RequestDetail) {
  if (!request) {
    return group.category === "completed";
  }

  if (request.status === "COMPLETED" || request.status === "APPROVED") {
    return true;
  }

  if (!group.approvalId) {
    return false;
  }

  const approval = request.approvals.find((item) => item.id === group.approvalId);
  return Boolean(approval && approval.status !== "PENDING");
}

function getRequestSubject(request?: RequestDetail) {
  if (!request) {
    return null;
  }

  if (request.type === "NEW_HIRE") {
    const candidate = getCandidatePayload(request.payload);
    return (
      request.targetUser?.nameEn ??
      candidate?.nameEn ??
      candidate?.phoneNumber ??
      null
    );
  }

  return request.targetUser?.nameEn ?? request.sourceVendor?.vendorName ?? null;
}

function getCandidatePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = (payload as Record<string, unknown>).candidate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const values = candidate as Record<string, unknown>;
  return {
    nameEn: typeof values.nameEn === "string" ? values.nameEn : null,
    phoneNumber:
      typeof values.phoneNumber === "string" ? values.phoneNumber : null
  };
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <ListCardSkeleton rows={4} />
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">
        No notifications in this view.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Try another filter or check back after workflow activity.
      </p>
    </div>
  );
}

function getNotificationTone(category: NotificationCategory): {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
} {
  const tones: Record<
    NotificationCategory,
    {
      icon: ComponentType<{ className?: string }>;
      iconClassName: string;
    }
  > = {
    approvals: {
      icon: ClipboardCheck,
      iconClassName: "bg-emerald-50 text-emerald-700"
    },
    completed: {
      icon: CheckCheck,
      iconClassName: "bg-slate-100 text-slate-700"
    },
    requests: {
      icon: FileText,
      iconClassName: "bg-orange-50 text-primary"
    },
    system: {
      icon: Bell,
      iconClassName: "bg-blue-50 text-blue-700"
    }
  };

  return tones[category];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
