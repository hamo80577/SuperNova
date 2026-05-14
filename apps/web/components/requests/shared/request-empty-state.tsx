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
          ? "rounded-md border bg-background p-4 text-sm text-muted-foreground"
          : "grid place-items-center rounded-lg border bg-card p-8 text-center shadow-sm"
      }
    >
      {!compact ? <Inbox className="mb-3 h-8 w-8 text-muted-foreground" /> : null}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
