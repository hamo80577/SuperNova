import { Badge } from "@/components/ui/badge";
import { EmptyState } from "../../shared/request-empty-state";
import { type NewHireChainOption, type NewHireVendorOption } from "../../shared/request-types";

export function SelectedContextCard({
  loading,
  selectedChain,
  selectedVendor
}: {
  loading: boolean;
  selectedChain: Pick<NewHireChainOption, "chainCode" | "chainName"> | null;
  selectedVendor: NewHireVendorOption | null;
}) {
  if (loading) {
    return <EmptyState message="Loading selected Branch context." compact />;
  }

  if (!selectedVendor) {
    return <EmptyState message="Selected Branch context was not found." compact />;
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{selectedVendor.vendorName}</p>
          <p className="mt-1 text-xs text-slate-500">{selectedVendor.vendorCode}</p>
        </div>
        <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
          Branch locked
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <span>Chain: {selectedChain?.chainName ?? selectedVendor.chain.chainName}</span>
        <span>Code: {selectedChain?.chainCode ?? selectedVendor.chain.chainCode}</span>
      </div>
    </div>
  );
}
