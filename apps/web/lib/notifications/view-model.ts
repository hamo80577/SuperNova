import type { NotificationItem } from "@/lib/api/notifications";

export type NotificationCategory =
  | "approvals"
  | "completed"
  | "requests"
  | "system";

export type NotificationFilter =
  | "all"
  | "approvals"
  | "completed"
  | "requests"
  | "unread";

export interface NotificationGroup {
  id: string;
  requestId: string | null;
  approvalId: string | null;
  approvalStep: string | null;
  category: NotificationCategory;
  items: NotificationItem[];
  latest: NotificationItem;
  targetHref: string;
  unreadCount: number;
}

export function groupNotifications(items: NotificationItem[]) {
  const sortedItems = [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
  const groupMap = new Map<string, NotificationItem[]>();

  for (const item of sortedItems) {
    const requestId = extractRequestId(item.payload);
    const key = requestId ? `request:${requestId}` : `notification:${item.id}`;
    groupMap.set(key, [...(groupMap.get(key) ?? []), item]);
  }

  return Array.from(groupMap.entries()).map(([id, groupItems]) => {
    const latest = groupItems[0];
    const requestId = extractRequestId(latest.payload);
    const approvalSource =
      groupItems.find((item) => extractApprovalId(item.payload)) ?? latest;

    return {
      id,
      requestId,
      approvalId: extractApprovalId(approvalSource.payload),
      approvalStep: extractApprovalStep(approvalSource.payload),
      category: getNotificationCategory(latest),
      items: groupItems,
      latest,
      targetHref: requestId ? `/tickets?requestId=${requestId}` : "/notifications",
      unreadCount: groupItems.filter((item) => !item.readAt).length
    } satisfies NotificationGroup;
  });
}

export function sortNotificationGroups(groups: NotificationGroup[]) {
  return [...groups].sort((left, right) => {
    const byUnread = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
    if (byUnread) {
      return byUnread;
    }

    return (
      new Date(right.latest.createdAt).getTime() -
      new Date(left.latest.createdAt).getTime()
    );
  });
}

export function filterNotificationGroups(
  groups: NotificationGroup[],
  filter: NotificationFilter
) {
  if (filter === "all") {
    return groups;
  }

  if (filter === "unread") {
    return groups.filter((group) => group.unreadCount > 0);
  }

  return groups.filter((group) => group.category === filter);
}

export function isQuickApproveEligible(group: NotificationGroup) {
  return (
    group.category === "approvals" &&
    Boolean(group.approvalId) &&
    Boolean(group.approvalStep) &&
    group.approvalStep !== "ADMIN_FINAL_APPROVAL"
  );
}

export function extractRequestId(payload: unknown) {
  const value = getPayloadValue(payload, "requestId");
  return typeof value === "string" ? value : null;
}

export function extractApprovalId(payload: unknown) {
  const value = getPayloadValue(payload, "approvalId");
  return typeof value === "string" ? value : null;
}

export function extractApprovalStep(payload: unknown) {
  const value = getPayloadValue(payload, "step");
  return typeof value === "string" ? value : null;
}

export function getNotificationCategory(
  item: NotificationItem
): NotificationCategory {
  if (
    item.type.includes("COMPLETED") ||
    item.type.includes("APPROVED") ||
    item.type.includes("REJECTED") ||
    item.type.includes("CANCELLED")
  ) {
    return "completed";
  }

  if (item.type.includes("APPROVAL")) {
    return "approvals";
  }

  if (item.type.includes("REQUEST") || extractRequestId(item.payload)) {
    return "requests";
  }

  return "system";
}

export function formatNotificationLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPayloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return (payload as Record<string, unknown>)[key] ?? null;
}
