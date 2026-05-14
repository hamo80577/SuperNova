"use client";

import { type Vendor } from "@/lib/api/organization";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../shared/request-empty-state";

export function BranchChoiceList({
  onSelect,
  selectedVendorId,
  vendors
}: {
  onSelect: (vendor: Vendor) => void;
  selectedVendorId: string;
  vendors: Vendor[];
}) {
  return (
    <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {vendors.slice(0, 12).map((vendor) => (
        <button
          className={cn(
            "rounded-xl border bg-white p-3 text-left text-sm transition-colors",
            selectedVendorId === vendor.id
              ? "border-orange-300 bg-orange-50 text-orange-950"
              : "border-slate-200 text-slate-700 hover:border-orange-200"
          )}
          key={vendor.id}
          onClick={() => onSelect(vendor)}
          type="button"
        >
          <span className="block font-semibold">{vendor.vendorName}</span>
          <span className="block text-xs text-slate-500">
            {vendor.vendorCode} · {vendor.chain.chainName}
          </span>
        </button>
      ))}
      {!vendors.length ? (
        <EmptyState message="No Branch matches this Chain/search." compact />
      ) : null}
    </div>
  );
}
