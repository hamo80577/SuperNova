"use client";

import { Store, UserRound, Users } from "lucide-react";
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

export function AreaManagerChampsTable({
  champsPerformance
}: {
  champsPerformance: AreaManagerPerformanceSummary["champsPerformance"];
}) {
  const rows = champsPerformance.rows;

  return (
    <AreaManagerCard className="overflow-hidden">
      <SectionHeader
        eyebrow="Performance across each Champ's assigned branches"
        title="Champs Performance"
      />

      {!champsPerformance.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={
              champsPerformance.reason ??
              "No Champ performance rows are available."
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <SectionEmptyState
          message="No Champ performance rows for this period."
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <table className="sn-table">
              <thead>
                <tr>
                  <th>Champ Name</th>
                  <th>Branches</th>
                  <th>Total Pickers</th>
                  <th>Total Orders</th>
                  <th>UHO %</th>
                  <th>Att. Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.champId}>
                    <td>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ffe8d9] text-[color:var(--tlb-orange-900)]">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <p className="max-w-[220px] truncate font-semibold text-[color:var(--sn-ink)]">
                          {row.champName}
                        </p>
                      </div>
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.branchesCount)}
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalPickers)}
                    </td>
                    <td className="sn-mono font-semibold">
                      {formatNumber(row.totalOrders)}
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
                key={row.champId}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0e6] text-[color:var(--tlb-orange)]">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--sn-ink)]">
                        {row.champName}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--sn-muted)]">
                        <Store className="h-3 w-3" />
                        {formatNumber(row.branchesCount)} branches
                      </p>
                    </div>
                  </div>
                  <PerformanceStatusBadge status={row.status} />
                </div>

                <DashboardMetricGrid columns={4}>
                  <MobileMetric
                    icon={<Store className="h-3 w-3" />}
                    label="Branches"
                    value={formatNumber(row.branchesCount)}
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

                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="sn-mono text-xs font-semibold text-[color:var(--sn-body)]">
                    {formatNumber(row.totalOrders)} orders
                  </p>
                  {row.reasonLabels.length ? (
                    <p className="min-w-0 truncate text-[11px] text-[color:var(--sn-muted)]">
                      {row.reasonLabels.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <DashboardSectionFooter>
            Showing {formatNumber(rows.length)} of{" "}
            {formatNumber(champsPerformance.totalRows)} champs
          </DashboardSectionFooter>
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
