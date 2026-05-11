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
        "grid place-items-center bg-white/25 backdrop-blur-[1px] transition-opacity duration-200 ease-out motion-reduce:transition-none",
        fixed ? "fixed inset-0 z-[999]" : "min-h-dvh",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="status"
    >
      <div
        aria-hidden="true"
        className="relative grid h-20 w-20 place-items-center sm:h-24 sm:w-24"
      >
        <span className="absolute inset-0 rounded-full border border-slate-950/5 bg-white/35 shadow-[0_18px_50px_rgba(15,23,42,0.10)]" />
        <span className="absolute inset-2 rounded-full border-2 border-orange-500/15" />
        <span className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#FF5A00] border-r-[#FF5A00]/70 animate-spin motion-reduce:animate-none" />
        <span className="absolute inset-5 rounded-full border border-[#FF5A00]/20 animate-pulse motion-reduce:animate-none" />
        <span className="relative h-3 w-3 rounded-full bg-[#FF5A00] shadow-[0_0_22px_rgba(255,90,0,0.55)]" />
      </div>
    </div>
  );
}
