"use client";

import {
  AlertCircle,
  Archive,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  GitBranch,
  Inbox,
  ShieldCheck,
  Store,
  UploadCloud,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton
} from "@/components/ui/skeleton";
import {
  reportsApi,
  type AdminReportsOverview,
  type AreaManagerReportsOverview,
  type ChampReportsOverview,
  type CountBreakdownItem
} from "@/lib/api/reports";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function AdminReportsPage() {
  const state = useReportData(reportsApi.adminOverview);

  return (
    <ReportShell
      badge="System-wide reports"
      description="Operational counts across Chains, Branches, assignments, requests, profile completion, archive state, and open actions."
      title="Admin Reports"
    >
      <StateView state={state}>
        {(data) => <AdminReportContent data={data} />}
      </StateView>
    </ReportShell>
  );
}

export function AreaManagerReportsPage() {
  const state = useReportData(reportsApi.areaManagerOverview);

  return (
    <ReportShell
      badge="Scoped Chain reports"
      description="Counts are limited to active Chains assigned to you through Chain Area Manager assignments."
      title="Area Manager Reports"
    >
      <StateView state={state}>
        {(data) => <AreaManagerReportContent data={data} />}
      </StateView>
    </ReportShell>
  );
}

export function ChampReportsPage() {
  const state = useReportData(reportsApi.champOverview);

  return (
    <ReportShell
      badge="Branch-scoped reports"
      description="Counts are limited to Branches assigned to you through active Vendor Champ assignments."
      title="Champ Reports"
    >
      <StateView state={state}>
        {(data) => <ChampReportContent data={data} />}
      </StateView>
    </ReportShell>
  );
}

function AdminReportContent({ data }: { data: AdminReportsOverview }) {
  return (
    <ReportGrid>
      <MetricCard icon={GitBranch} label="Active Chains" value={data.cards.activeChains} />
      <MetricCard icon={Store} label="Active Branches" value={data.cards.activeVendors} />
      <MetricCard icon={Users} label="Active Pickers" value={data.cards.activePickers} />
      <MetricCard
        icon={ShieldCheck}
        label="Pending Admin final actions"
        value={data.cards.pendingAdminFinalActions}
      />

      <BreakdownCard
        items={data.breakdowns.usersByRole}
        title="Workforce by Role"
      />
      <BreakdownCard
        items={data.breakdowns.usersByAccountStatus}
        title="Users by Account Status"
      />
      <BreakdownCard
        items={data.breakdowns.usersByEmploymentStatus}
        title="Users by Employment Status"
      />
      <BreakdownCard
        items={data.breakdowns.requestsByStatus}
        title="Requests by Status"
      />
      <BreakdownCard
        items={data.breakdowns.requestsByType}
        title="Requests by Type"
      />
      <BreakdownCard
        items={data.breakdowns.profileCompletion}
        title="Profile Completion"
      />

      <InfoCard title="Archive & Block Summary">
        <Definition label="Archived/deactivated Pickers" value={data.cards.archivedDeactivatedPickers} />
        <Definition label="Temporary block" value={data.breakdowns.archiveBlockSummary.temporaryBlock} />
        <Definition label="Permanent block" value={data.breakdowns.archiveBlockSummary.permanentBlock} />
        <Definition label="No block among archived" value={data.breakdowns.archiveBlockSummary.noBlockAmongArchived} />
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/admin/archived-users"
          prefetch
        >
          Open archived users
        </Link>
      </InfoCard>

      <InfoCard title="Open Actions Summary">
        <Definition label="Pending approvals" value={data.cards.pendingApprovals} />
        <Definition label="Pending Admin final actions" value={data.cards.pendingAdminFinalActions} />
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/tickets"
          prefetch
        >
          Open pending actions
        </Link>
      </InfoCard>

      <InfoCard title="Attendance Report">
        <Definition label="Scope" value="Picker daily rows" />
        <Definition label="Source" value="Active confirmed batches" />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/reports/attendance"
            prefetch
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Daily report
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/attendance/imports"
            prefetch
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Import console
          </Link>
        </div>
      </InfoCard>

      <InfoCard title="Orders KPI Report">
        <Definition label="Scope" value="Chain, vendor, and picker KPI rows" />
        <Definition label="Source" value="Confirmed Orders KPI daily records" />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/reports/orders-kpi"
            prefetch
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Performance report
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/imports/orders-kpi"
            prefetch
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Import console
          </Link>
        </div>
      </InfoCard>

      <SimpleTable
        columns={["Chain", "Code", "Active Pickers"]}
        rows={data.tables.topChainsByActivePickerCount.map((item) => [
          item.chain.chainName,
          item.chain.chainCode,
          item.activePickerCount
        ])}
        title="Top Chains by Active Picker Count"
      />
      <SimpleTable
        columns={["Branch", "Chain", "Active Pickers"]}
        rows={data.tables.topVendorsByActivePickerCount.map((item) => [
          item.vendor?.vendorName ?? "Unknown Branch",
          item.vendor?.chain?.chainName ?? "Unknown Chain",
          item.activePickerCount
        ])}
        title="Top Branches by Active Picker Count"
      />
    </ReportGrid>
  );
}

function AreaManagerReportContent({
  data
}: {
  data: AreaManagerReportsOverview;
}) {
  return (
    <ReportGrid>
      <InfoCard title="Operational Reports">
        <Definition label="Scope" value="Your assigned chains" />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/area-manager/reports/attendance"
            prefetch
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Attendance report
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/area-manager/reports/orders-kpi"
            prefetch
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Orders KPI report
          </Link>
        </div>
      </InfoCard>

      <MetricCard icon={GitBranch} label="Assigned Chains" value={data.cards.chains} />
      <MetricCard icon={Store} label="Branches in scope" value={data.cards.vendors} />
      <MetricCard icon={Users} label="Active Pickers" value={data.cards.activePickers} />
      <MetricCard icon={ShieldCheck} label="Pending approvals" value={data.cards.pendingApprovals} />

      <BreakdownCard
        items={data.breakdowns.requestsByStatus}
        title="Requests in My Chains"
      />
      <BreakdownCard
        items={data.breakdowns.requestsByType}
        title="Request Types in Scope"
      />
      <BreakdownCard
        items={data.breakdowns.profileCompletion}
        title="Picker Profile Completion"
      />
      <BreakdownCard
        items={data.breakdowns.archiveBlockSummary}
        title="Archive/Block in Scope"
      />

      <SimpleTable
        columns={["Chain", "Branches", "Active Pickers", "Active Champs"]}
        rows={data.tables.chains.map((item) => [
          item.chain.chainName,
          item.vendorCount,
          item.activePickerCount,
          item.activeChampCount
        ])}
        title="Workforce by Chain"
      />
      <SimpleTable
        columns={["Branch", "Chain", "Active Pickers", "Active Champs"]}
        rows={data.tables.vendors.map((item) => [
          item.vendor.vendorName,
          item.chain.chainName,
          item.activePickerCount,
          item.activeChampCount
        ])}
        title="Workforce by Branch"
      />
    </ReportGrid>
  );
}

function ChampReportContent({ data }: { data: ChampReportsOverview }) {
  return (
    <ReportGrid>
      <InfoCard title="Operational Reports">
        <Definition label="Scope" value="Your assigned branches" />
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/champ/reports/attendance"
            prefetch
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Attendance report
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/champ/reports/orders-kpi"
            prefetch
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Orders KPI report
          </Link>
        </div>
      </InfoCard>

      <MetricCard icon={Store} label="Assigned Branches" value={data.cards.assignedBranches} />
      <MetricCard icon={Users} label="Active Pickers" value={data.cards.activePickers} />
      <MetricCard
        icon={ClipboardList}
        label="Open submitted requests"
        value={data.cards.openSubmittedRequests}
      />
      <MetricCard icon={Archive} label="Completed outcomes" value={data.cards.completedOutcomes} />

      <BreakdownCard
        items={data.breakdowns.profileCompletion}
        title="Picker Profile Completion"
      />
      <BreakdownCard
        items={data.breakdowns.requestsByStatus}
        title="My Submitted Requests"
      />
      <BreakdownCard
        items={data.breakdowns.requestsByType}
        title="My Request Types"
      />
      <InfoCard title="Workflow Outcomes">
        <Definition
          label="New Hires completed"
          value={data.breakdowns.workflowOutcomes.newHiresCompleted}
        />
        <Definition
          label="Transfers completed"
          value={data.breakdowns.workflowOutcomes.transfersCompleted}
        />
        <Definition
          label="Resignations completed"
          value={data.breakdowns.workflowOutcomes.offboardingCompleted}
        />
      </InfoCard>

      <SimpleTable
        columns={["Branch", "Chain", "Active Pickers"]}
        rows={data.tables.branches.map((item) => [
          item.vendor.vendorName,
          item.chain.chainName,
          item.activePickerCount
        ])}
        title="Picker Counts by Branch"
      />
    </ReportGrid>
  );
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

function ReportShell({
  badge,
  children,
  description,
  title
}: {
  badge: string;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{badge}</Badge>
            <h1 className="mt-3 text-xl font-semibold">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
      </section>
      {children}
    </div>
  );
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
        aria-label="Loading operational counts"
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

function ReportGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-4">{children}</div>;
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}

function BreakdownCard({
  items,
  title
}: {
  items: CountBreakdownItem[];
  title: string;
}) {
  return (
    <InfoCard title={title}>
      {items.some((item) => item.count > 0) ? (
        items.map((item) => (
          <Definition
            key={item.key}
            label={formatEnum(item.key)}
            value={<StatusCount value={item.count} />}
          />
        ))
      ) : (
        <EmptyInline message="No counts available yet." />
      )}
    </InfoCard>
  );
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function SimpleTable({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th className="py-3 pr-4" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr className="border-b last:border-0" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="py-3 pr-4" key={cellIndex}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No rows available for this report." />
      )}
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

function StatusCount({ value }: { value: number }) {
  return (
    <Badge variant={value > 0 ? "default" : "outline"}>
      <span className="tabular-nums">{value}</span>
    </Badge>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-md border bg-background p-6 text-center">
      <Inbox className="mb-3 h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{message}</p>;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
