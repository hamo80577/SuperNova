"use client";

import { ArrowRight, ShieldAlert, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";

export function BranchActionMenu({
  onClose,
  onNewHire,
  onResignation,
  onTransfer
}: {
  onClose: () => void;
  onNewHire: () => void;
  onResignation: () => void;
  onTransfer: () => void;
}) {
  const actions = [
    {
      icon: ArrowRight,
      label: "Transfer",
      onClick: onTransfer,
      tone: "text-[color:var(--tlb-lavender)] bg-[oklch(0.95_0.04_280)]"
    },
    {
      icon: ShieldAlert,
      label: "Resignation",
      onClick: onResignation,
      tone: "text-[oklch(0.62_0.13_70)] bg-[oklch(0.95_0.05_80)]"
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
      <div className="absolute right-0 top-12 z-50 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-[color:var(--sn-border)] bg-white p-2 shadow-[0_8px_32px_rgba(65,21,23,0.12)]">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold text-[color:var(--sn-ink)]">Choose action</p>
          <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
            More tools can be added here later.
          </p>
        </div>
        <div className="grid gap-1">
          <button
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)]"
            onClick={() => {
              onClose();
              onNewHire();
            }}
            type="button"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
              <UserPlus className="h-4 w-4" />
            </span>
            New Hire
          </button>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)]"
                key={action.label}
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                type="button"
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
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
