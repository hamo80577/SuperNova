"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RequestSummary } from "@/lib/api/requests";
import { EmptyState } from "./champ-branch-states";
import { formatDate, formatEnum } from "./champ-branch-utils";

export function BranchRequests({
  onOpenRequest,
  requests
}: {
  onOpenRequest: (requestId: string) => void;
  requests: RequestSummary[];
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <h2 className="text-lg font-semibold text-[color:var(--sn-ink)]">Recent requests</h2>
      <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
        Branch-scoped request records created by this Champ.
      </p>
      {requests.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[color:var(--sn-border)] text-xs uppercase text-[color:var(--sn-faint)]">
              <tr>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Current Step</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr className="border-b border-[color:var(--sn-border)] last:border-0" key={request.id}>
                  <td className="py-3 pr-4 font-medium text-[color:var(--sn-ink)]">
                    {formatEnum(request.type)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="muted">{formatEnum(request.status)}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-[color:var(--sn-muted)]">
                    {request.currentStep ? formatEnum(request.currentStep) : "None"}
                  </td>
                  <td className="py-3 pr-4 text-[color:var(--sn-muted)]">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      className="rounded-xl"
                      onClick={() => onOpenRequest(request.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No request history exists for this Branch yet." />
      )}
    </section>
  );
}
