import { AlertCircle, Inbox } from "lucide-react";

import { TableRowsSkeleton } from "@/components/ui/skeleton";

export function LoadingRows({ label }: { label: string }) {
  return <TableRowsSkeleton label={label} rows={4} />;
}

export function EmptyState({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="grid place-items-center rounded-md border bg-card p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}
