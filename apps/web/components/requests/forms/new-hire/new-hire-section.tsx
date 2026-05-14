import type { ReactNode } from "react";

export function NewHireFormSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}
