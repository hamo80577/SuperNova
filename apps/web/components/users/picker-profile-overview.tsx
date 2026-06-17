"use client";

import {
  Building2,
  CalendarDays,
  Hash,
  MessageCircle,
  Network,
  Phone,
  ShieldCheck,
  UserRound
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import type { OperationalProfileResponse } from "@/lib/api/users";
import { cn } from "@/lib/utils";
import {
  formatDate,
  getPrimaryAssignmentLabel,
  getProfileOperationalStatus,
  getProfileChainLabel,
  type UserOperationalStatus
} from "./users-display-utils";

export function PickerProfileOverview({
  profile,
  whatsappHref
}: {
  profile: OperationalProfileResponse;
  whatsappHref: string;
}) {
  const user = profile.user;
  const assignment = profile.currentPickerAssignment;
  const operationalStatus = getProfileOperationalStatus(profile);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ProfilePanel
        icon={<UserRound className="h-4 w-4" />}
        title="Identity & contact"
      >
        <ProfileInfoRow
          action={
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton
                aria-label="Copy phone"
                className="h-10 w-10 p-0"
                iconOnly
                text={user.phoneNumber}
              />
              <a
                aria-label="Open WhatsApp chat"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)] transition hover:bg-[oklch(0.88_0.06_150)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.58_0.13_150)] active:scale-[0.96]"
                href={whatsappHref}
                rel="noreferrer"
                target="_blank"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          }
          icon={<Phone className="h-4 w-4" />}
          label="Phone"
          value={user.phoneNumber}
        />
        <ProfileInfoRow
          action={
            user.shopperId ? (
              <CopyButton
                aria-label="Copy Shopper ID"
                className="h-10 w-10 p-0"
                iconOnly
                text={user.shopperId}
              />
            ) : null
          }
          icon={<Hash className="h-4 w-4" />}
          label="Shopper ID"
          value={user.shopperId ?? "Not set"}
        />
        <ProfileInfoRow
          action={
            user.ibsId ? (
              <CopyButton
                aria-label="Copy IBS ID"
                className="h-10 w-10 p-0"
                iconOnly
                text={user.ibsId}
              />
            ) : null
          }
          icon={<Hash className="h-4 w-4" />}
          label="IBS ID"
          value={user.ibsId ?? "Not set"}
        />
        <ProfileInfoRow
          action={
            user.nationalId ? (
              <CopyButton
                aria-label="Copy National ID"
                className="h-10 w-10 p-0"
                iconOnly
                text={user.nationalId}
              />
            ) : null
          }
          icon={<ShieldCheck className="h-4 w-4" />}
          label="National ID"
          value={user.nationalId || "Not set"}
        />
      </ProfilePanel>

      <ProfilePanel
        icon={<Building2 className="h-4 w-4" />}
        title="Operational context"
      >
        <ProfileInfoRow
          icon={<Building2 className="h-4 w-4" />}
          label="Current Branch"
          value={getPrimaryAssignmentLabel(profile)}
        />
        <ProfileInfoRow
          icon={<Network className="h-4 w-4" />}
          label="Chain"
          value={getProfileChainLabel(profile)}
        />
        <ProfileInfoRow
          icon={<CalendarDays className="h-4 w-4" />}
          label="Assignment start"
          value={formatDate(assignment?.startDate ?? null)}
        />
        <ProfileInfoRow
          icon={<CalendarDays className="h-4 w-4" />}
          label="Worked days"
          value={profile.workedDays === null ? "Not set" : `${profile.workedDays} days`}
        />
        <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">
              Operational status
            </p>
            <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{operationalStatus.title}</p>
          </div>
          <StateBadge status={operationalStatus} />
        </div>
      </ProfilePanel>
    </section>
  );
}

function ProfilePanel({
  children,
  icon,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] ring-1 ring-[#FFD8BD]">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">{title}</h3>
        </div>
      </div>
      <div className="mt-4 divide-y divide-[color:var(--sn-border)]">{children}</div>
    </section>
  );
}

function ProfileInfoRow({
  action,
  icon,
  label,
  value
}: {
  action?: ReactNode;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-[color:var(--sn-ink)]">
            {value}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StateBadge({
  status
}: {
  status: UserOperationalStatus;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        status.tone === "active" &&
          "border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        status.tone === "pending" &&
          "border-[oklch(0.88_0.08_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]",
        status.tone === "resigned" && "border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
      )}
      title={status.title}
      variant="outline"
    >
      {status.label}
    </Badge>
  );
}
