import { cn } from "@/lib/utils";

export function AppLoadingOverlay({
  fixed = true,
  label = "Loading",
  visible = true
}: {
  fixed?: boolean;
  label?: string;
  visible?: boolean;
}) {
  return (
    <div
      aria-label={label}
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "grid place-items-center bg-[color:var(--sn-bg)] transition-opacity duration-200 ease-out motion-reduce:transition-none",
        fixed ? "fixed inset-0 z-[999]" : "min-h-dvh",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="status"
    >
      <div className="w-full max-w-[220px] px-6 text-center">
        <div
          aria-hidden="true"
          className="mx-auto h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--sn-sunken)]"
        >
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        </div>
        <p className="mt-4 text-sm font-medium text-[color:var(--sn-body)]">{label}</p>
      </div>
    </div>
  );
}
