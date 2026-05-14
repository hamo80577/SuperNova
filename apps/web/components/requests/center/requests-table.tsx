import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { RequestSummary } from "@/lib/api/requests";

import { RequestStatusBadge } from "../shared/request-badges";
import { formatEnum } from "../shared/request-utils";

export function RequestsTable({ items }: { items: RequestSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Created By</th>
            <th className="py-3 pr-4">Source</th>
            <th className="py-3 pr-4">Current Step</th>
            <th className="py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((request) => (
            <tr className="border-b last:border-0" key={request.id}>
              <td className="py-3 pr-4 font-medium">{formatEnum(request.type)}</td>
              <td className="py-3 pr-4">
                <RequestStatusBadge status={request.status} />
              </td>
              <td className="py-3 pr-4">{request.createdBy.nameEn}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {request.sourceVendor?.vendorName ??
                  request.sourceChain?.chainName ??
                  "No source"}
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {request.currentStep ? formatEnum(request.currentStep) : "None"}
              </td>
              <td className="py-3 text-right">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/tickets?requestId=${request.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
