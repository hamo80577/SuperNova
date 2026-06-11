"use client";

import {
  ChevronRight,
  MinusCircle,
  Palette,
  Target,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import type { UserRole } from "@/lib/auth/types";

interface SettingsLink {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = [
  "PICKER",
  "CHAMP",
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];

const systemSettingsLinks: SettingsLink[] = [
  {
    description:
      "Global percentage thresholds that drive in-target and out-of-target status across Orders KPI reports.",
    href: "/admin/settings/orders-kpi-targets",
    icon: Target,
    label: "Orders KPI Targets",
    roles: ["ADMIN", "SUPER_ADMIN"]
  },
  {
    description:
      "Occurrence rules and penalties applied by Deduction tickets.",
    href: "/settings/deductions",
    icon: MinusCircle,
    label: "Deduction Policy",
    roles: ["ADMIN", "SUPER_ADMIN"]
  }
];

const personalSettingsLinks: SettingsLink[] = [
  {
    description: "Choose the accent color used across your SuperNova workspace.",
    href: "/settings/appearance",
    icon: Palette,
    label: "Appearance",
    roles: ALL_ROLES
  }
];

export function SettingsHubPage() {
  const { user } = useAuth();
  const role = user?.role;
  const visibleSystemLinks = role
    ? systemSettingsLinks.filter((link) => link.roles.includes(role))
    : [];
  const visiblePersonalLinks = role
    ? personalSettingsLinks.filter((link) => link.roles.includes(role))
    : [];

  return (
    <div className="grid gap-6">
      {visibleSystemLinks.length ? (
        <SettingsSection
          description="Website-wide configuration. Changes apply to every user."
          links={visibleSystemLinks}
          title="System settings"
        />
      ) : null}

      {visiblePersonalLinks.length ? (
        <SettingsSection
          description="Preferences that only affect your own workspace."
          links={visiblePersonalLinks}
          title="Personal settings"
        />
      ) : null}
    </div>
  );
}

function SettingsSection({
  description,
  links,
  title
}: {
  description: string;
  links: SettingsLink[];
  title: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <SettingsLinkCard key={link.href} link={link} />
        ))}
      </div>
    </section>
  );
}

function SettingsLinkCard({ link }: { link: SettingsLink }) {
  const Icon = link.icon;

  return (
    <Link
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:p-5"
      href={link.href}
      prefetch
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950">
          {link.label}
        </span>
        <span className="mt-0.5 block text-sm leading-6 text-slate-500">
          {link.description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-primary" />
    </Link>
  );
}
