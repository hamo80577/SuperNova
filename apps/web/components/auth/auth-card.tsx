import type { ReactNode } from "react";
import Image from "next/image";

import { APP_NAME } from "@supernova/shared";

export function AuthCard({
  children,
  subtitle,
  title,
  variant = "simple"
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
  variant?: "simple" | "login";
}) {
  if (variant === "login") {
    return (
      <main className="min-h-dvh overflow-x-hidden bg-[#F4F8FA] text-slate-950 lg:grid lg:grid-cols-[55%_45%]">
        <section
          aria-hidden="true"
          className="relative hidden min-h-dvh overflow-hidden bg-[#DDEAF0] lg:block"
        >
          <Image
            alt=""
            className="object-cover object-center"
            fill
            priority
            sizes="55vw"
            src="/images/auth/login/login-image.webp"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#DDEAF0]/20 via-transparent to-[#F4F8FA]/55" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-[#F4F8FA]" />
        </section>

        <section className="flex min-h-dvh w-full items-start justify-center px-5 py-8 sm:px-6 lg:items-center lg:bg-[#F4F8FA] lg:px-10">
          <div className="w-full max-w-[420px] rounded-[22px] border border-sky-100/90 bg-white p-5 shadow-[0_18px_55px_rgba(15,60,90,0.08)] sm:p-7 lg:border-slate-100 lg:shadow-[0_22px_60px_rgba(15,60,90,0.06)]">
            <div className="mb-7 space-y-5">
              <div>
                <h1 className="text-[28px] font-semibold leading-9 tracking-normal text-slate-950">
                  {APP_NAME}
                </h1>
              </div>
              <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
                {title}
              </h2>
            </div>
            {children}
          </div>
        </section>
      </main>
    );
  }

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
            {subtitle ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
