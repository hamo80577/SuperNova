"use client";

import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  GitBranch,
  LineChart,
  Store,
  Users,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DetailPanelSkeleton, StatsCardSkeleton } from "@/components/ui/skeleton";
import {
  reportsApi,
  type AdminReportsOverview,
  type AreaManagerReportsOverview,
  type ChampReportsOverview,
  type CountBreakdownItem
} from "@/lib/api/reports";

type OperationsAnalysisVariant = "admin" | "area-manager" | "champ";
type OperationsAnalysisOverview =
  | AdminReportsOverview
  | AreaManagerReportsOverview
  | ChampReportsOverview;

type AsyncState<T> =
  | { status: "loading"; data?: T; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const pageCopy: Record<
  OperationsAnalysisVariant,
  {
    badge: string;
    description: string;
    title: string;
  }
> = {
  admin: {
    badge: "System analysis",
    description:
      "Read-only operational snapshot built from current workforce, assignment, and request data.",
    title: "Operations Analysis"
  },
  "area-manager": {
    badge: "Chain analysis",
    description:
      "Read-only operational snapshot for your assigned Chain scope.",
    title: "Operations Analysis"
  },
  champ: {
    badge: "Branch analysis",
    description:
      "Read-only operational snapshot for your assigned Branch scope.",
    title: "Operations Analysis"
  }
};

const loaderByVariant: Record<
  OperationsAnalysisVariant,
  () => Promise<OperationsAnalysisOverview>
> = {
  admin: reportsApi.adminOverview,
  "area-manager": reportsApi.areaManagerOverview,
  champ: reportsApi.champOverview
};

export function OperationsAnalysisReportPage({
  variant = "admin"
}: {
  variant?: OperationsAnalysisVariant;
}) {
  const state = useOperationsAnalysisData(loaderByVariant[variant]);
  const copy = pageCopy[variant];

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
          <LineChart className="h-6 w-6 text-primary" />
        </div>
      </section>

      <AnalysisStateView state={state}>
        {(data) => <AnalysisContent data={data} variant={variant} />}
      </AnalysisStateView>
    </div>
  );
}

function AnalysisContent({
  data,
  variant
}: {
  data: OperationsAnalysisOverview;
  variant: OperationsAnalysisVariant;
}) {
  const metrics = useMemo(() => getMetrics(variant, data), [data, variant]);
  const signals = useMemo(() => getSignals(variant, data), [data, variant]);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              className="rounded-lg border bg-card p-4 shadow-sm"
              key={metric.label}
            >
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metric.label}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AnalysisPanel title="Operational Signals">
          {signals.length ? (
            signals.map((signal) => (
              <Definition
                key={signal.label}
                label={signal.label}
                value={signal.value}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No operational signal is available for this scope yet.
            </p>
          )}
        </AnalysisPanel>

        <AnalysisPanel title="Report Inputs">
          <Definition label="Workforce overview" value="Connected" />
          <Definition label="Attendance report" value="Connected" />
          <Definition label="Performance report" value="Connected" />
          <Definition label="External upload" value="Not used" />
        </AnalysisPanel>
      </section>
    </>
  );
}

function getMetrics(
  variant: OperationsAnalysisVariant,
  data: OperationsAnalysisOverview
): Array<{ icon: LucideIcon; label: string; value: number }> {
  if (variant === "admin") {
    const overview = data as AdminReportsOverview;
    return [
      { icon: GitBranch, label: "Active Chains", value: overview.cards.activeChains },
      { icon: Store, label: "Active Branches", value: overview.cards.activeVendors },
      { icon: Users, label: "Active Pickers", value: overview.cards.activePickers },
      {
        icon: ClipboardList,
        label: "Pending approvals",
        value: overview.cards.pendingApprovals
      }
    ];
  }

  if (variant === "area-manager") {
    const overview = data as AreaManagerReportsOverview;
    return [
      { icon: GitBranch, label: "Assigned Chains", value: overview.cards.chains },
      { icon: Store, label: "Branches in scope", value: overview.cards.vendors },
      { icon: Users, label: "Active Pickers", value: overview.cards.activePickers },
      { icon: ClipboardList, label: "Open actions", value: overview.cards.openActions }
    ];
  }

  const overview = data as ChampReportsOverview;
  return [
    { icon: Store, label: "Assigned Branches", value: overview.cards.assignedBranches },
    { icon: Users, label: "Active Pickers", value: overview.cards.activePickers },
    {
      icon: ClipboardList,
      label: "Open requests",
      value: overview.cards.openSubmittedRequests
    },
    { icon: BarChart3, label: "Completed outcomes", value: overview.cards.completedOutcomes }
  ];
}

function getSignals(
  variant: OperationsAnalysisVariant,
  data: OperationsAnalysisOverview
) {
  if (variant === "admin") {
    const overview = data as AdminReportsOverview;
    return [
      {
        label: "Largest request status",
        value: formatTopBreakdown(overview.breakdowns.requestsByStatus)
      },
      {
        label: "Largest request type",
        value: formatTopBreakdown(overview.breakdowns.requestsByType)
      },
      {
        label: "Archived/deactivated Pickers",
        value: overview.cards.archivedDeactivatedPickers
      },
      {
        label: "Pending final actions",
        value: overview.cards.pendingAdminFinalActions
      }
    ];
  }

  if (variant === "area-manager") {
    const overview = data as AreaManagerReportsOverview;
    return [
      {
        label: "Largest request status",
        value: formatTopBreakdown(overview.breakdowns.requestsByStatus)
      },
      {
        label: "Largest request type",
        value: formatTopBreakdown(overview.breakdowns.requestsByType)
      },
      { label: "Active Champs", value: overview.cards.activeChamps },
      { label: "Pending approvals", value: overview.cards.pendingApprovals }
    ];
  }

  const overview = data as ChampReportsOverview;
  return [
    {
      label: "Largest request status",
      value: formatTopBreakdown(overview.breakdowns.requestsByStatus)
    },
    {
      label: "Largest request type",
      value: formatTopBreakdown(overview.breakdowns.requestsByType)
    },
    {
      label: "New hires completed",
      value: overview.breakdowns.workflowOutcomes.newHiresCompleted
    },
    {
      label: "Transfers completed",
      value: overview.breakdowns.workflowOutcomes.transfersCompleted
    }
  ];
}

function formatTopBreakdown(items: CountBreakdownItem[]) {
  const topItem = [...items].sort((left, right) => right.count - left.count)[0];

  if (!topItem || topItem.count === 0) {
    return "No counts";
  }

  return `${formatEnum(topItem.key)} (${topItem.count})`;
}

function useOperationsAnalysisData<T>(loader: () => Promise<T>) {
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
                : "Unable to load operations analysis."
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

function AnalysisStateView<T>({
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
        aria-label="Loading operations analysis"
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

function AnalysisPanel({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
