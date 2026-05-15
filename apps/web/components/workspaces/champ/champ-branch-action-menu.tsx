"use client";

import { ArrowRight, ShieldAlert, UserPlus } from "lucide-react";
import Link from "next/link";

import type { ChampBranchDetail } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

export function BranchActionMenu({
  branch,
  onClose
}: {
  branch: ChampBranchDetail;
  onClose: () => void;
}) {
  const actions = [
    {
      href: `/champ/branches/${branch.vendor.id}/new-hire`,
      icon: UserPlus,
      label: "New Hire",
      tone: "text-orange-700 bg-orange-50"
    },
    {
      href: `/champ/branches/${branch.vendor.id}/transfer`,
      icon: ArrowRight,
      label: "Transfer",
      tone: "text-blue-700 bg-blue-50"
    },
    {
      href: `/champ/branches/${branch.vendor.id}/resignation`,
      icon: ShieldAlert,
      label: "Resignation",
      tone: "text-amber-700 bg-amber-50"
    },
  ];

  return (
    <>
      <button
        aria-label="Close actions"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="absolute right-0 top-12 z-50 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold text-slate-950">Choose action</p>
          <p className="mt-0.5 text-xs text-slate-500">
            More tools can be added here later.
          </p>
        </div>
        <div className="grid gap-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={action.href}
                key={action.label}
                prefetch
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl",
                    action.tone
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
