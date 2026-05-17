import type { RequestDetail } from "@/lib/api/requests";

import { formatEnum } from "../shared/request-utils";

type TimelineItem = RequestDetail["timeline"][number];

export function RequestTimeline({
  importantOnly = false,
  items,
  limit,
  variant = "page"
}: {
  importantOnly?: boolean;
  items: TimelineItem[];
  limit?: number;
  variant?: "modal" | "page";
}) {
  const timelineItems = importantOnly ? getImportantTimelineItems(items) : items;
  const visibleItems =
    typeof limit === "number" ? timelineItems.slice(0, limit) : timelineItems;

  if (variant === "modal") {
    return (
      <div className="grid gap-3">
        {visibleItems.map((item) => (
          <div className="flex gap-3" key={item.id}>
            <div className="mt-1.5 h-2 w-2 rounded-full bg-orange-500" />
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {importantOnly ? getImportantTimelineLabel(item) : formatEnum(item.type)}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(item.at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {visibleItems.map((item) => (
        <div className="flex gap-3" key={item.id}>
          <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
          <div>
            <p className="text-sm font-medium">
              {importantOnly ? getImportantTimelineLabel(item) : formatEnum(item.type)}
            </p>
            <p className="text-xs text-muted-foreground">
              {importantOnly ? "" : `${item.label} · `}
              {new Date(item.at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function getImportantTimelineItems(items: TimelineItem[]) {
  const significantTypes = new Set([
    "REQUEST_CREATED",
    "APPROVAL_APPROVED",
    "APPROVAL_REJECTED",
    "REQUEST_REJECTED",
    "REQUEST_CANCELLED",
    "REQUEST_COMPLETED"
  ]);
  const seen = new Set<string>();

  return items.filter((item) => {
    if (!significantTypes.has(item.type)) {
      return false;
    }

    const key =
      item.type === "REQUEST_CREATED"
        ? "REQUEST_CREATED"
        : `${item.type}:${new Date(item.at).toISOString()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getImportantTimelineLabel(item: TimelineItem) {
  if (item.type === "REQUEST_CREATED") return "Created";
  if (item.type === "APPROVAL_APPROVED") return "Approved";
  if (item.type === "APPROVAL_REJECTED" || item.type === "REQUEST_REJECTED") {
    return "Rejected";
  }
  if (item.type === "REQUEST_CANCELLED") return "Cancelled";
  if (item.type === "REQUEST_COMPLETED") return "Closed";

  return formatEnum(item.type);
}
