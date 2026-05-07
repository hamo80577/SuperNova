import type { ReactNode } from "react";

import { APP_NAME } from "@supernova/shared";

export function AuthCard({
  children,
  subtitle,
  title
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="grid min-h-dvh bg-background px-6 py-10 text-foreground lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden border-r bg-muted/40 p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">
            {APP_NAME}
          </p>
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight text-foreground">
            Partner workforce operations control.
          </h1>
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p>Assignments, approvals, and role workspaces.</p>
          <p>Backend-enforced identity and access controls.</p>
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase text-primary">
              {APP_NAME}
            </p>
            <h2 className="text-2xl font-semibold text-card-foreground">
              {title}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
