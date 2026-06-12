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
    <section className="grid min-w-0 gap-3 border-b border-[color:var(--sn-border)] px-4 py-4 last:border-b-0 sm:px-5">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">{description}</p>
      </div>
      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}
