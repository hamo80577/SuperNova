import { type ReactNode } from "react";

export function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}
