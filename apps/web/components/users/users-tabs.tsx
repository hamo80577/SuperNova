"use client";

import { cn } from "@/lib/utils";
import type { UsersSectionId } from "./users-area-types";

export function UsersTabs({
  activeSection,
  counts,
  onSelect,
  sections
}: {
  activeSection: UsersSectionId;
  counts: Record<UsersSectionId, number>;
  onSelect: (section: UsersSectionId) => void;
  sections: Array<{ id: UsersSectionId; label: string }>;
}) {
  if (!sections.length) {
    return null;
  }

  return (
    <div className="overflow-hidden pb-1">
      <div
        aria-label="User role sections"
        className="flex min-w-0 items-center gap-1 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-1"
        role="tablist"
      >
        {sections.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              aria-selected={active}
              className={cn(
                "relative inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[color:var(--sn-body)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)] sm:gap-2 sm:px-4 sm:text-sm",
                active
                  ? "bg-[color:var(--sn-card)] text-[color:var(--tlb-orange-900)] shadow-sm ring-1 ring-[#FFD8BD]"
                  : "hover:bg-[color:var(--sn-card)]/80 hover:text-[color:var(--sn-ink)]"
              )}
              key={section.id}
              onClick={() => onSelect(section.id)}
              role="tab"
              type="button"
            >
              <span className="min-w-0 text-center leading-tight">{section.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-4 sm:px-2",
                  active
                    ? "bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                    : "bg-[color:var(--sn-card)] text-[color:var(--sn-muted)] ring-1 ring-[color:var(--sn-border)]"
                )}
              >
                {counts[section.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
