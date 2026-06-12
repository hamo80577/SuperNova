import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[color:var(--sn-sunken)] motion-reduce:animate-none",
        className
      )}
    />
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading page header"
      className={cn(
        "rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5",
        className
      )}
      role="status"
    >
      <Skeleton className="h-5 w-28 rounded-full bg-primary/15" />
      <Skeleton className="mt-4 h-7 w-3/4 max-w-sm" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-md" />
    </section>
  );
}

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
    >
      <Skeleton className="h-10 w-10 rounded-xl bg-primary/15" />
      <Skeleton className="mt-5 h-6 w-16" />
      <Skeleton className="mt-2 h-3.5 w-28" />
    </div>
  );
}

export function BranchCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-2/3 max-w-48" />
          <Skeleton className="mt-3 h-4 w-1/2 max-w-36" />
        </div>
        <Skeleton className="h-9 w-9 rounded-full bg-primary/15" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );
}

export function ListCardSkeleton({
  className,
  rows = 3
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className={cn(
            "flex items-center gap-3 py-3",
            index > 0 && "border-t border-[color:var(--sn-border)]"
          )}
          key={index}
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-primary/15" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  className,
  label = "Loading table rows",
  rows = 5
}: {
  className?: string;
  label?: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={cn(
        "rounded-[16px] border border-[color:var(--sn-border)] bg-white p-3 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]",
        className
      )}
      role="status"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className={cn(
            "grid gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(90px,0.7fr))]",
            index > 0 && "border-t border-[color:var(--sn-border)]"
          )}
          key={index}
        >
          <Skeleton className="h-5 w-full max-w-56" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function DetailPanelSkeleton({
  className,
  label = "Loading detail panel"
}: {
  className?: string;
  label?: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className={cn(
        "grid gap-4 rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5",
        className
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-24 rounded-full bg-primary/15" />
          <Skeleton className="mt-4 h-6 w-3/4 max-w-sm" />
          <Skeleton className="mt-3 h-4 w-2/3 max-w-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
    </section>
  );
}
