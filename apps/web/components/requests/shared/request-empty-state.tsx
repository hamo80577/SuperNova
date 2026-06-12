import { Inbox } from "lucide-react";

export function EmptyState({
  compact,
  message
}: {
  compact?: boolean;
  message: string;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-muted)]"
          : "grid place-items-center rounded-[16px] border border-[color:var(--sn-border)] bg-white p-8 text-center shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]"
      }
    >
      {!compact ? <Inbox className="mb-3 h-8 w-8 text-[color:var(--sn-muted)]" /> : null}
      <p className="text-sm text-[color:var(--sn-muted)]">{message}</p>
    </div>
  );
}
