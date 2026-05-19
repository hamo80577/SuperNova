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
  formatEnum,
  getPrimaryAssignmentLabel,
  getProfileChainLabel
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

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ProfilePanel
        icon={<UserRound className="h-4 w-4" />}
        title="Identity & contact"
      >
        <ProfileInfoRow
          action={
            <a
              aria-label="Open WhatsApp chat"
              className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.96]"
              href={whatsappHref}
              rel="noreferrer"
              target="_blank"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
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
        {user.nationalId ? (
          <ProfileInfoRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label="National ID"
            value={user.nationalId}
          />
        ) : null}
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
        <div className="flex flex-wrap gap-1.5 pt-1">
          <StateBadge label={formatEnum(user.profileStatus)} tone="slate" />
          <StateBadge label={formatEnum(user.accountStatus)} tone="orange" />
          <StateBadge
            label={formatEnum(user.employmentStatus)}
            tone={user.employmentStatus === "ACTIVE" ? "green" : "red"}
          />
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-700 ring-1 ring-orange-100">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
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
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-950">
            {value}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StateBadge({
  label,
  tone
}: {
  label: string;
  tone: "green" | "orange" | "red" | "slate";
}) {
  return (
    <Badge
      className={cn(
        "rounded-full",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "orange" && "border-orange-200 bg-orange-50 text-orange-700",
        tone === "red" && "border-red-200 bg-red-50 text-red-700",
        tone === "slate" && "border-slate-200 bg-slate-50 text-slate-700"
      )}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
