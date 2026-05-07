import { ArrowRight, ShieldCheck } from "lucide-react";

import { APP_NAME, CORE_DOMAIN_NOTE } from "@supernova/shared";

import { Button } from "@/components/ui/button";

const priorities = [
  "Assignment-derived hierarchy, never hard-coded manager ownership.",
  "Request and approval workflows for sensitive picker lifecycle events.",
  "Backend-enforced scope, state, and auditability from the start."
];

export function OpsShell() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.12),_transparent_35%)]" />
      <div className="absolute inset-0 bg-ops-grid bg-[size:56px_56px] opacity-40" />
      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-6 py-10 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">
              {APP_NAME}
            </p>
            <p className="text-sm text-slate-300">{CORE_DOMAIN_NOTE}</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-300 md:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Phase 0 foundation
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
              Workforce operations system
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Operational control for chains, vendors, pickers, and approvals.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                SuperNova is being structured as a modular monolith for partner
                workforce operations. This landing shell is intentionally narrow:
                foundation first, workflow implementation later.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Open Login Placeholder</Button>
              <Button size="lg" variant="outline">
                API Health Contract
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Launch Baseline
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  What this phase locks in
                </h2>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                Ready for auth next
              </div>
            </div>
            <div className="space-y-4">
              {priorities.map((priority) => (
                <div
                  key={priority}
                  className="rounded-2xl border border-white/8 bg-white/5 p-4"
                >
                  <p className="text-sm leading-7 text-slate-200">{priority}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 rounded-2xl border border-white/8 bg-slate-950/80 p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Frontend</span>
                <span className="font-medium text-white">Next.js + Tailwind</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Backend</span>
                <span className="font-medium text-white">NestJS + Prisma</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Data model</span>
                <span className="font-medium text-white">
                  Assignment-first
                </span>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
