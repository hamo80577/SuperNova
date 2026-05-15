import { ArrowRight, ShieldAlert, Store, Users } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/admin/status-badge";
import { buttonVariants } from "@/components/ui/button";
import type { ChampBranch } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

export function BranchCard({ branch }: { branch: ChampBranch }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-950">
            {branch.vendor.vendorName}
          </p>
          <p className="mt-1 truncate text-sm text-slate-500">
            {branch.chain.chainName}
          </p>
        </div>
        <StatusBadge status={branch.assignment.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <MiniMetric icon={Users} label="Pickers" value={branch.activePickerCount} />
        <MiniMetric
          icon={ShieldAlert}
          label="Pending"
          value={branch.pendingRequestCount}
        />
      </div>
      <Link
        className={cn(buttonVariants({ size: "sm" }), "mt-4 h-10 w-full rounded-xl")}
        href={`/champ/branches/${branch.vendor.id}`}
        prefetch
      >
        Open Branch
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </article>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Store;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
