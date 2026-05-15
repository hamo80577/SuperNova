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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">Recent requests</h2>
      <p className="mt-1 text-sm text-slate-500">
        Branch-scoped request records created by this Champ.
      </p>
      {requests.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
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
                <tr className="border-b border-slate-100 last:border-0" key={request.id}>
                  <td className="py-3 pr-4 font-medium text-slate-950">
                    {formatEnum(request.type)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="muted">{formatEnum(request.status)}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {request.currentStep ? formatEnum(request.currentStep) : "None"}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
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
