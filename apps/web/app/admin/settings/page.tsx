import Link from "next/link";
import { Target } from "lucide-react";

import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AppearanceSettingsPage } from "@/components/settings/appearance-settings-page";

export default function AdminSettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Personal appearance controls for your SuperNova workspace."
      title="Settings"
    >
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                Orders KPI Targets
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Set global percentage thresholds for Orders KPI performance.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            href="/admin/settings/orders-kpi-targets"
          >
            Open targets
          </Link>
        </div>
      </section>
      <AppearanceSettingsPage />
    </DashboardFrame>
  );
}
