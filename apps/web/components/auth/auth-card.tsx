import type { ReactNode } from "react";
import Image from "next/image";

import { SnLogo, PoweredBy } from "@/components/sn/sn-brand";

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
      <main className="min-h-dvh overflow-x-hidden bg-[color:var(--sn-bg)] text-[color:var(--sn-ink)] lg:grid lg:grid-cols-[55%_45%]">
        <section
          aria-hidden="true"
          className="relative hidden min-h-dvh overflow-hidden bg-[color:var(--tlb-cream)] lg:block"
        >
          <Image
            alt=""
            className="object-cover object-center"
            fill
            priority
            sizes="55vw"
            src="/images/auth/login/login-image.webp"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[color:var(--tlb-cream)]/20 via-transparent to-[color:var(--sn-bg)]/55" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-[color:var(--sn-bg)]" />
        </section>

        <section className="flex min-h-dvh w-full items-start justify-center px-5 py-8 sm:px-6 lg:items-center lg:bg-[color:var(--sn-bg)] lg:px-10">
          <div className="w-full max-w-[420px] rounded-[22px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-5 shadow-[0_18px_55px_rgba(65,21,23,0.07)] sm:p-7 lg:shadow-[0_22px_60px_rgba(65,21,23,0.06)]">
            <div className="mb-7 space-y-5">
              <div className="flex flex-col gap-3">
                <SnLogo size={32} type={18} />
                <PoweredBy />
              </div>
              <h2 className="text-2xl font-semibold tracking-normal text-[color:var(--sn-ink)]">
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
    <main className="grid min-h-dvh bg-[color:var(--sn-bg)] px-6 py-10 text-[color:var(--sn-ink)] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden border-r border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-10 lg:flex lg:flex-col lg:justify-between">
        <div>
          <SnLogo size={28} type={15} />
          <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight text-[color:var(--sn-ink)]">
            Partner workforce operations control.
          </h1>
        </div>
        <div className="grid gap-3 text-sm text-[color:var(--sn-muted)]">
          <p>Assignments, approvals, and role workspaces.</p>
          <p>Backend-enforced identity and access controls.</p>
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-6 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
          <div className="mb-6 space-y-2">
            <SnLogo size={24} type={13} />
            <h2 className="text-2xl font-semibold text-[color:var(--sn-ink)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm leading-6 text-[color:var(--sn-muted)]">
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
