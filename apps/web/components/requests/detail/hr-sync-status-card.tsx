"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MinusCircle
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { type RequestHrSyncStatus } from "@/lib/api/requests";
import { InfoCard } from "../shared/request-info-card";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const workflowLabels: Record<RequestHrSyncStatus["workflowType"], string> = {
  PICKER_NEW_HIRE: "Picker New Hire",
  PICKER_REHIRE: "Picker Rehire",
  PICKER_RESIGNATION: "Picker Resignation"
};

const targetSheetLabels: Record<RequestHrSyncStatus["targetSheet"], string> = {
  NEW_HIRE: "New Hire sheet",
  RESIGN: "Resign sheet"
};

const statusConfig: Record<
  RequestHrSyncStatus["status"],
  {
    Icon: IconComponent;
    className: string;
    label: string;
    fallbackDetail: string;
  }
> = {
  SENT: {
    Icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    label: "Sent to HR",
    fallbackDetail: "Recorded in the HR sheet."
  },
  FAILED: {
    Icon: AlertTriangle,
    className: "border-red-200 bg-red-50 text-red-800",
    label: "HR Sync failed",
    fallbackDetail: "The workflow is complete. HR sync can be retried later."
  },
  SKIPPED: {
    Icon: MinusCircle,
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "HR Sync skipped",
    fallbackDetail: "HR sync is disabled."
  },
  NOT_SENT: {
    Icon: Clock3,
    className: "border-slate-200 bg-slate-50 text-slate-700",
    label: "HR Sync pending",
    fallbackDetail: "Waiting to send to HR."
  }
};

export function HrSyncStatusCard({
  hrSync
}: {
  hrSync?: RequestHrSyncStatus | null;
}) {
  if (!hrSync) {
    return null;
  }

  const config = statusConfig[hrSync.status];
  const Icon = config.Icon;
  const detail =
    hrSync.status === "FAILED"
      ? hrSync.errorMessage ?? config.fallbackDetail
      : hrSync.status === "SKIPPED"
        ? hrSync.errorMessage ?? config.fallbackDetail
        : config.fallbackDetail;

  return (
    <InfoCard title="HR Sync">
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 ${config.className}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{config.label}</p>
            <p className="mt-1 break-words text-sm opacity-85">{detail}</p>
          </div>
        </div>
        <div className="grid gap-2 text-xs opacity-85 sm:grid-cols-3">
          <span>{workflowLabels[hrSync.workflowType]}</span>
          <span>{targetSheetLabels[hrSync.targetSheet]}</span>
          <span>{formatHrSyncDate(hrSync.sentAt ?? hrSync.updatedAt)}</span>
        </div>
      </div>
    </InfoCard>
  );
}

function formatHrSyncDate(value?: string | null) {
  if (!value) {
    return "Time not recorded";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Time not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}
