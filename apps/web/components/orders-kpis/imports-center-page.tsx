"use client";

import Link from "next/link";
import { BarChart3, CalendarCheck2, FileSpreadsheet, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const importCards = [
  {
    description: "Preview, review, and confirm daily Orders KPI snapshots.",
    href: "/admin/imports/orders-kpi",
    icon: FileSpreadsheet,
    label: "Orders KPI Import",
    status: "Ready"
  },
  {
    description: "Existing attendance import workflow.",
    href: "/admin/attendance/imports",
    icon: CalendarCheck2,
    label: "Attendance Import",
    status: "Existing"
  }
];

const reportCards = [
  {
    description: "Read confirmed Orders KPI daily records by chain, vendor, and picker.",
    href: "/admin/reports/orders-kpi",
    icon: BarChart3,
    label: "Orders KPI Report"
  },
  {
    description: "Open the operational reports center.",
    href: "/admin/reports",
    icon: UploadCloud,
    label: "Reports Center"
  }
];

export function ImportsCenterPage() {
  return (
    <div className="min-w-0 overflow-hidden rounded-3xl bg-slate-50/80 p-3 sm:p-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Imports Center</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Admin import workflows for operational files. Each import opens with preview and review before confirmed records are written.
            </p>
          </div>
          <Badge variant="muted">Admin only</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {importCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                href={card.href}
                key={card.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge variant="muted">{card.status}</Badge>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">
                  {card.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {card.description}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-primary group-hover:underline">
                  Open import
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <p className="text-sm font-semibold text-slate-950">Related reports</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reportCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-primary/30 hover:bg-white"
                href={card.href}
                key={card.href}
              >
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {card.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
