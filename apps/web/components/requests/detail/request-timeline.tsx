import type { RequestDetail } from "@/lib/api/requests";

import { formatEnum } from "../shared/request-utils";

type TimelineItem = RequestDetail["timeline"][number];

export function RequestTimeline({
  items,
  limit,
  variant = "page"
}: {
  items: TimelineItem[];
  limit?: number;
  variant?: "modal" | "page";
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

  if (variant === "modal") {
    return (
      <div className="grid gap-3">
        {visibleItems.map((item) => (
          <div className="flex gap-3" key={item.id}>
            <div className="mt-1.5 h-2 w-2 rounded-full bg-orange-500" />
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {formatEnum(item.type)}
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
            <p className="text-sm font-medium">{formatEnum(item.type)}</p>
            <p className="text-xs text-muted-foreground">
              {item.label} · {new Date(item.at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
