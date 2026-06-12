import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function SettingsBackLink() {
  return (
    <Link
      className="mb-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-sm font-semibold text-[color:var(--sn-body)] transition hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href="/settings"
      prefetch
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Settings
    </Link>
  );
}
