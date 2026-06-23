"use client";

import { Store, Users } from "lucide-react";
import type { ReactNode } from "react";

import type { AreaManagerPerformanceSummary } from "@/lib/api/area-manager-performance";
import {
  DashboardMetricGrid,
  DashboardMetricItem,
  DashboardSectionFooter
} from "@/components/workspaces/dashboard-ui/dashboard-primitives";
import {
  formatNumber,
  formatPercent,
  healthToneClass,
  uhoToneClass
} from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  PerformanceStatusBadge,
  SectionEmptyState,
  SectionHeader,
  SectionUnavailable
} from "./area-manager-metric-card";

export function AreaManagerBranchesTable({
  branchesPerformance
}: {
  branchesPerformance: AreaManagerPerformanceSummary["branchesPerformance"];
}) {
  const rows = branchesPerformance.rows;

  return (
    <AreaManagerCard className="overflow-hidden">
      <SectionHeader
        eyebrow="Operational performance by assigned branch"
        title="Branches Performance"
      />

      {!branchesPerformance.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={
              branchesPerformance.reason ??
              "No branch performance rows are available."
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <SectionEmptyState
          message="No branch performance rows for this period."
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Champ Name</th>
                  <th>Total Orders</th>
                  <th>Total Pickers</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.vendorId}>
                    <td>
                      <p className="max-w-[230px] truncate font-semibold text-[color:var(--sn-ink)]">
                        {row.vendorName}
                      </p>
                      <p className="max-w-[230px] truncate text-[11px] text-[color:var(--sn-muted)]">
                        {row.chainName}
                      </p>
                    </td>
                    <td className="max-w-[190px] truncate font-medium">
                      {row.champName ?? "Not assigned"}
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalOrders)}
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalPickers)}
                    </td>
                    <td className={uhoToneClass(row.unhealthyRate)}>
                      {formatPercent(row.unhealthyRate)}
                    </td>
                    <td className={healthToneClass(row.attendanceHealthRate)}>
                      {formatPercent(row.attendanceHealthRate)}
                    </td>
                    <td>
                      <PerformanceStatusBadge status={row.status} />
                      {row.reasonLabels.length ? (
                        <p className="mt-1 max-w-[180px] truncate text-[10px] text-[color:var(--sn-muted)]">
                          {row.reasonLabels.join(" · ")}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 xl:hidden">
            {rows.map((row) => (
              <article
                className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3"
                key={row.vendorId}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0e6] text-[color:var(--tlb-orange)]">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)]">
                        {row.vendorName}
                      </h3>
                      <p className="mt-0.5 truncate text-[11px] text-[color:var(--sn-muted)]">
                        {row.chainName} · {row.champName ?? "No Champ"}
                      </p>
                    </div>
                  </div>
                  <PerformanceStatusBadge status={row.status} />
                </div>

                <DashboardMetricGrid columns={4}>
                  <MobileMetric
                    label="Orders"
                    value={formatNumber(row.totalOrders)}
                  />
                  <MobileMetric
                    icon={<Users className="h-3 w-3" />}
                    label="Pickers"
                    value={formatNumber(row.totalPickers)}
                  />
                  <MobileMetric
                    label="UHO"
                    value={formatPercent(row.unhealthyRate)}
                  />
                  <MobileMetric
                    label="Att."
                    value={formatPercent(row.attendanceHealthRate)}
                  />
                </DashboardMetricGrid>

                {row.reasonLabels.length ? (
                  <p className="text-[11px] leading-5 text-[color:var(--sn-muted)]">
                    {row.reasonLabels.join(" · ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <TableFooter
            label={`Showing ${formatNumber(rows.length)} of ${formatNumber(
              branchesPerformance.totalRows
            )} branches`}
          />
        </>
      )}
    </AreaManagerCard>
  );
}

function MobileMetric({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return <DashboardMetricItem icon={icon} label={label} value={value} />;
}

function TableFooter({ label }: { label: string }) {
  return <DashboardSectionFooter>{label}</DashboardSectionFooter>;
}
