import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type OffboardingPickerSearchItem } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { Definition } from "../../shared/request-field";
import { formatEnum } from "../../shared/request-utils";

export function PickerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

export function PickerIdentityCard({ picker }: { picker: OffboardingPickerSearchItem }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <PickerAvatar name={picker.picker.nameEn} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-950">
                {picker.picker.nameEn}
              </h3>
              <Badge variant="muted">{formatEnum(picker.picker.employmentStatus)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {picker.picker.phoneNumber}
              {picker.picker.shopperId ? ` · Shopper ${picker.picker.shopperId}` : ""}
              {picker.picker.ibsId ? ` · IBS ${picker.picker.ibsId}` : ""}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "w-fit",
            picker.hasPendingResignation
              ? "border-red-200 bg-red-50 text-red-700"
              : ""
          )}
          variant="outline"
        >
          {picker.hasPendingResignation ? "Pending Resignation" : "Ready"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Definition label="Branch" value={picker.vendor.vendorName} />
        <Definition label="Chain" value={picker.chain.chainName} />
        <Definition
          label="Assignment start"
          value={new Date(picker.assignmentStartDate).toLocaleDateString()}
        />
        <Definition label="Block status" value={formatEnum(picker.picker.blockStatus)} />
      </div>
    </section>
  );
}
