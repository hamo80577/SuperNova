"use client";

import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  Inbox,
  LineChart,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DetailPanelSkeleton, StatsCardSkeleton } from "@/components/ui/skeleton";
import {
  reportsApi,
  type AdminReportsOverview,
  type AreaManagerReportsOverview,
  type ChampReportsOverview
} from "@/lib/api/reports";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

type ReportsHubVariant = "admin" | "area-manager" | "champ";
type ReportsOverview =
  | AdminReportsOverview
  | AreaManagerReportsOverview
  | ChampReportsOverview;

interface ReportCardDefinition {
  description: string;
  href: string;
  icon: LucideIcon;
  meta: Array<{ label: string; value: ReactNode }>;
  status: string;
  title: string;
}

const hubCopy: Record<
  ReportsHubVariant,
  {
    badge: string;
    description: string;
    scope: string;
    title: string;
  }
> = {
  admin: {
    badge: "System reports",
    description:
      "Choose a read-only report, then open the full workspace when you need filters, tables, and deeper analysis.",
    scope: "System-wide",
    title: "Reports"
  },
  "area-manager": {
    badge: "Scoped reports",
    description:
      "Choose a report scoped to the Chains and Branches assigned to your workspace.",
    scope: "Assigned Chains",
    title: "Reports"
  },
  champ: {
    badge: "Branch reports",
    description:
      "Choose a report scoped to the Branches and Pickers assigned to your workspace.",
    scope: "Assigned Branches",
    title: "Reports"
  }
};

const basePathByVariant: Record<ReportsHubVariant, string> = {
  admin: "/admin",
  "area-manager": "/area-manager",
  champ: "/champ"
};

export function AdminReportsPage() {
  const state = useReportData(reportsApi.adminOverview);

  return <ReportsHub state={state} variant="admin" />;
}

export function AreaManagerReportsPage() {
  const state = useReportData(reportsApi.areaManagerOverview);

  return <ReportsHub state={state} variant="area-manager" />;
}

export function ChampReportsPage() {
  const state = useReportData(reportsApi.champOverview);

  return <ReportsHub state={state} variant="champ" />;
}

function ReportsHub({
  state,
  variant
}: {
  state: AsyncState<ReportsOverview>;
  variant: ReportsHubVariant;
}) {
  const copy = hubCopy[variant];

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Badge variant="outline">{copy.badge}</Badge>
            <h1 className="mt-3 text-xl font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
      </section>

      <StateView state={state}>
        {(data) => (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {buildReportCards(variant, data).map((report) => (
              <ReportPreviewCard key={report.href} report={report} />
            ))}
          </section>
        )}
      </StateView>
    </div>
  );
}

function ReportPreviewCard({ report }: { report: ReportCardDefinition }) {
  const Icon = report.icon;

  return (
    <article className="flex min-h-[260px] flex-col rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <Badge variant="muted">{report.status}</Badge>
      </div>

      <div className="mt-4 min-w-0">
        <h2 className="text-base font-semibold">{report.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {report.description}
        </p>
      </div>

      <dl className="mt-4 grid gap-2 border-t pt-4">
        {report.meta.map((item) => (
          <div
            className="flex items-center justify-between gap-3 text-sm"
            key={item.label}
          >
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="max-w-[55%] truncate text-right font-medium">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "mt-auto w-full justify-center"
        )}
        href={report.href}
        prefetch
      >
        See more
      </Link>
    </article>
  );
}

function buildReportCards(
  variant: ReportsHubVariant,
  data: ReportsOverview
): ReportCardDefinition[] {
  const basePath = basePathByVariant[variant];
  const scope = hubCopy[variant].scope;
  const activePickers = getActivePickers(data);
  const branchCount = getBranchCount(variant, data);

  return [
    {
      description:
        "Performance report for Orders KPI records with Chain, Branch, and Picker views.",
      href: `${basePath}/reports/orders-kpi`,
      icon: FileSpreadsheet,
      meta: [
        { label: "Scope", value: scope },
        { label: "Rows", value: "Confirmed KPI records" },
        { label: "Views", value: "Chain / Branch / Picker" }
      ],
      status: "Live",
      title: "Performance"
    },
    {
      description:
        "Daily attendance report for Picker rows, calculated status, lateness, leave, and work hours.",
      href: `${basePath}/reports/attendance`,
      icon: CalendarDays,
      meta: [
        { label: "Scope", value: scope },
        { label: "Rows", value: "Confirmed attendance" },
        { label: "Active Pickers", value: activePickers }
      ],
      status: "Live",
      title: "Attendance"
    },
    {
      description:
        "Read-only operational analysis that combines workforce scope, requests, and report readiness.",
      href: `${basePath}/reports/operations-analysis`,
      icon: LineChart,
      meta: [
        { label: "Scope", value: scope },
        { label: "Branches", value: branchCount },
        { label: "Mode", value: "Analysis only" }
      ],
      status: "Next",
      title: "Operations Analysis"
    }
  ];
}

function getActivePickers(data: ReportsOverview) {
  return "activePickers" in data.cards ? data.cards.activePickers : 0;
}

function getBranchCount(variant: ReportsHubVariant, data: ReportsOverview) {
  if (variant === "admin") {
    return (data as AdminReportsOverview).cards.activeVendors;
  }

  if (variant === "area-manager") {
    return (data as AreaManagerReportsOverview).cards.vendors;
  }

  return (data as ChampReportsOverview).cards.assignedBranches;
}

function useReportData<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await loader();
        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        if (mounted) {
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to load reports."
          });
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [loader]);

  return state;
}

function StateView<T>({
  children,
  state
}: {
  children: (data: T) => ReactNode;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading report previews"
        className="grid gap-4 lg:grid-cols-4"
        role="status"
      >
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <DetailPanelSkeleton className="lg:col-span-2" />
        <DetailPanelSkeleton className="lg:col-span-2" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {state.error}
      </div>
    );
  }

  return <>{children(state.data)}</>;
}

export function EmptyReportState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-lg border bg-background p-6 text-center">
      <Inbox className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
