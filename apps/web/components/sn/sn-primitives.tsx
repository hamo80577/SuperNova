import type { CSSProperties, ReactNode } from "react";

import { type RequestStatus, type RequestType } from "@/lib/api/requests";
import { SnIcon, type SnIconName } from "./sn-icon";

/**
 * Calm Talabat shared primitives — status badges, request-type chips, avatars,
 * and tiny layout helpers. Status/type maps mirror the real SuperNova enums.
 */

type BadgeTone = "pending" | "approved" | "rejected" | "draft" | "info" | "warn";

const STATUS_META: Record<RequestStatus, [BadgeTone, string]> = {
  DRAFT: ["draft", "Draft"],
  PENDING_AREA_MANAGER: ["pending", "Pending Area Manager"],
  PENDING_DESTINATION_AREA_MANAGER: ["pending", "Pending Dest. AM"],
  PENDING_ADMIN: ["pending", "Pending Admin"],
  APPROVED: ["approved", "Approved"],
  COMPLETED: ["approved", "Completed"],
  REJECTED: ["rejected", "Rejected"],
  CANCELLED: ["draft", "Cancelled"]
};

export function SnStatusBadge({ status }: { status: RequestStatus }) {
  const [tone, label] = STATUS_META[status] ?? ["draft", status];
  return (
    <span className={`sn-badge sn-badge-${tone}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

type TypeTone = "hire" | "resign" | "transfer" | "deduct";

const TYPE_META: Record<RequestType, [TypeTone, string, SnIconName]> = {
  NEW_HIRE: ["hire", "New Hire", "plus"],
  RESIGNATION: ["resign", "Resignation", "minus"],
  TRANSFER: ["transfer", "Transfer", "swap"],
  DEDUCTION: ["deduct", "Deduction", "doc"]
};

export function SnTypeChip({
  type,
  compact = false
}: {
  type: RequestType;
  compact?: boolean;
}) {
  const [tone, label, icon] = TYPE_META[type] ?? ["hire", type, "doc"];
  return (
    <span className={`sn-type sn-type-${tone}`}>
      <SnIcon name={icon} size={12} />
      {compact ? null : label}
    </span>
  );
}

export function SnAvatar({
  name,
  lg = false,
  bg
}: {
  name: string;
  lg?: boolean;
  bg?: string;
}) {
  const initials =
    name
      .split(" ")
      .map((word) => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className={`sn-avatar${lg ? " lg" : ""}`}
      style={bg ? { background: bg } : undefined}
    >
      {initials}
    </span>
  );
}

export function SnRow({
  gap = 8,
  center = false,
  style,
  children
}: {
  gap?: number;
  center?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap,
        alignItems: center ? "center" : "stretch",
        ...style
      }}
    >
      {children}
    </div>
  );
}

export function SnCol({
  gap = 8,
  style,
  children
}: {
  gap?: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <div style={{ display: "grid", gap, ...style }}>{children}</div>;
}
