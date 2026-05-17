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
    <section className="grid min-w-0 gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}
