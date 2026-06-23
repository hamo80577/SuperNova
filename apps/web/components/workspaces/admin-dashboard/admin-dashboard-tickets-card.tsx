"use client";

import {
  CheckCircle2,
  Clock3,
  TicketCheck,
  UserRoundCheck,
  XCircle
} from "lucide-react";
import type { ReactNode } from "react";

import type { AdminPerformanceSummary } from "@/lib/api/admin-performance";
import { formatNumber } from "./admin-dashboard-utils";
import {
  AdminDashboardCard,
  AdminSectionHeader,
  AdminSectionUnavailable
} from "./admin-dashboard-metric-card";

export function AdminDashboardTicketsCard({
  ticketsSummary
}: {
  ticketsSummary: AdminPerformanceSummary["ticketsSummary"];
}) {
  return (
    <AdminDashboardCard className="overflow-hidden">
      <AdminSectionHeader
        eyebrow="Created and closed request activity for the selected scope"
        title="Tickets Summary"
      />

      {!ticketsSummary.available ? (
        <div className="p-4">
          <AdminSectionUnavailable
            message={
              ticketsSummary.reason ??
              "Ticket summary is unavailable for this period."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
          <TicketMetric
            icon={<TicketCheck className="h-5 w-5" />}
            label="Opened in period"
            tone="orange"
            value={ticketsSummary.openedInPeriod ?? ticketsSummary.totalTickets}
          />
          <TicketMetric
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Closed in period"
            tone="green"
            value={ticketsSummary.closedInPeriod}
          />
          <TicketMetric
            icon={<Clock3 className="h-5 w-5" />}
            label="Open now"
            tone="red"
            value={ticketsSummary.openNow}
          />
          <TicketMetric
            icon={<UserRoundCheck className="h-5 w-5" />}
            label="Waiting my action"
            tone="amber"
            value={ticketsSummary.waitingMyAction}
          />
          <TicketMetric
            icon={<XCircle className="h-5 w-5" />}
            label="Rejected / Cancelled"
            tone="slate"
            value={ticketsSummary.rejectedOrCancelled}
          />
        </div>
      )}
    </AdminDashboardCard>
  );
}

function TicketMetric({
  icon,
  label,
  tone,
  value
}: {
  icon: ReactNode;
  label: string;
  tone: "amber" | "green" | "orange" | "red" | "slate";
  value: number | undefined;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--sn-border)] bg-[#fffaf6] p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={ticketIconClassName(tone)}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium leading-4 text-[color:var(--sn-muted)]">
            {label}
          </p>
          <p className="sn-num mt-1 text-lg text-[color:var(--sn-ink)]">
            {formatNumber(value)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ticketIconClassName(
  tone: "amber" | "green" | "orange" | "red" | "slate"
) {
  const base =
    "grid h-10 w-10 shrink-0 place-items-center rounded-xl border";

  if (tone === "green") {
    return `${base} border-[color:var(--sn-success-bg)] bg-[color:var(--sn-success-bg)] text-[color:var(--sn-success)]`;
  }

  if (tone === "red") {
    return `${base} border-[color:var(--sn-danger-bg)] bg-[color:var(--sn-danger-bg)] text-[color:var(--sn-danger)]`;
  }

  if (tone === "amber") {
    return `${base} border-[#f7ddb4] bg-[#fff2d9] text-[#a36300]`;
  }

  if (tone === "slate") {
    return `${base} border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]`;
  }

  return `${base} border-[#ffd8bd] bg-[#ffe8d9] text-primary`;
}
