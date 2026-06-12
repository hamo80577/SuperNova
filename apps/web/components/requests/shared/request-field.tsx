import { type ReactNode } from "react";

export function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sn-border)] pb-2 last:border-b-0">
      <span className="min-w-0 text-sm text-[color:var(--sn-muted)]">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-[color:var(--sn-ink)]">{value}</span>
    </div>
  );
}
