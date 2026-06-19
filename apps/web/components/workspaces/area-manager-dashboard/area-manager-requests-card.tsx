"use client";

import Link from "next/link";

import { SnStatusBadge, SnTypeChip } from "@/components/sn/sn-primitives";
import type { RequestStatus, RequestType } from "@/lib/api/requests";
import type { AreaManagerPerformanceSummary } from "@/lib/api/area-manager-performance";
import { formatNumber } from "./area-manager-dashboard-utils";
import {
  AreaManagerCard,
  SectionEmptyState,
  SectionHeader,
  SectionUnavailable
} from "./area-manager-metric-card";

export function AreaManagerRequestsCard({
  latestRequests
}: {
  latestRequests: AreaManagerPerformanceSummary["latestRequests"];
}) {
  const rows = latestRequests.rows.slice(0, 6);

  return (
    <AreaManagerCard className="overflow-hidden">
      <SectionHeader
        eyebrow={
          latestRequests.totalOpenInScope === undefined
            ? undefined
            : `${formatNumber(latestRequests.totalOpenInScope)} open in scope`
        }
        title="Latest Requests"
      />

      {!latestRequests.available ? (
        <div className="p-4">
          <SectionUnavailable
            message={
              latestRequests.reason ?? "No recent requests are available."
            }
          />
        </div>
      ) : rows.length === 0 ? (
        <SectionEmptyState message="No recent requests in this period." />
      ) : (
        <>
          <div className="hidden md:block">
            <table className="sn-table [&_td]:px-4 [&_th]:px-4">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <SnTypeChip type={request.type as RequestType} />
                    </td>
                    <td>
                      <Link
                        className="block min-w-0 hover:text-primary"
                        href={`/tickets?requestId=${request.id}`}
                        prefetch
                      >
                        <span className="block max-w-[190px] truncate font-semibold text-[color:var(--sn-ink)]">
                          {request.targetUserName ?? "No target user"}
                        </span>
                        <span className="block text-[11px] text-[color:var(--sn-muted)]">
                          {request.targetShopperId ?? request.requestedByName ?? "-"}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="block max-w-[170px] truncate font-medium text-[color:var(--sn-body)]">
                        {request.branchName ?? "-"}
                      </span>
                      <span className="block max-w-[170px] truncate text-[11px] text-[color:var(--sn-muted)]">
                        {request.chainName ?? ""}
                      </span>
                    </td>
                    <td>
                      <SnStatusBadge status={request.status as RequestStatus} />
                    </td>
                    <td className="sn-mono whitespace-nowrap text-xs text-[color:var(--sn-muted)]">
                      {request.ageLabel ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 md:hidden">
            {rows.map((request) => (
              <Link
                className="grid min-w-0 gap-3 rounded-xl border border-[color:var(--sn-border)] bg-white p-3 transition hover:border-primary/25 hover:bg-[#fffaf6]"
                href={`/tickets?requestId=${request.id}`}
                key={request.id}
                prefetch
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <SnTypeChip type={request.type as RequestType} />
                    <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
                      {request.targetUserName ?? "No target user"}
                    </p>
                  </div>
                  <span className="sn-mono shrink-0 text-xs text-[color:var(--sn-muted)]">
                    {request.ageLabel ?? "-"}
                  </span>
                </div>

                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[color:var(--sn-body)]">
                      {request.branchName ?? "No branch"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--sn-muted)]">
                      {request.chainName ?? request.requestedByName ?? ""}
                    </p>
                  </div>
                  <SnStatusBadge status={request.status as RequestStatus} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </AreaManagerCard>
  );
}
