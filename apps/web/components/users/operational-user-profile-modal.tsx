"use client";

import {
  ArrowRightLeft,
  CalendarDays,
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  UserMinus,
  UserRound,
  X
} from "lucide-react";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SafeUser } from "@/lib/auth/types";
import {
  usersApi,
  type OperationalProfileResponse,
  type UpdateAdminProfileInput
} from "@/lib/api/users";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: OperationalProfileResponse; error?: never };

export interface OperationalUserProfileActions {
  onTransfer?: (user: SafeUser) => void;
  onResignation?: (user: SafeUser) => void;
}

export function OperationalUserProfileModal({
  actions,
  onClose,
  onUpdated,
  userId
}: {
  actions?: OperationalUserProfileActions;
  onClose: () => void;
  onUpdated?: () => void;
  userId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  async function loadProfile() {
    setState({ status: "loading" });
    try {
      setState({
        status: "ready",
        data: await usersApi.operationalProfile(userId)
      });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load profile."
      });
    }
  }

  useEffect(() => {
    void loadProfile();
  }, [userId]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-3"
      role="dialog"
    >
      <div className="flex max-h-[90dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        {state.status === "loading" ? (
          <ProfileShell title="Loading profile" onClose={onClose}>
            <CenteredState icon={<Loader2 className="h-5 w-5 animate-spin" />} label="Loading profile" />
          </ProfileShell>
        ) : state.status === "error" ? (
          <ProfileShell title="Profile unavailable" onClose={onClose}>
            <CenteredState
              action={<Button onClick={() => void loadProfile()}>Retry</Button>}
              label={state.error}
            />
          </ProfileShell>
        ) : (
          <ProfileContent
            actions={actions}
            onClose={onClose}
            onReload={() => {
              void loadProfile();
              onUpdated?.();
            }}
            profile={state.data}
          />
        )}
      </div>
    </div>
  );
}

function ProfileContent({
  actions,
  onClose,
  onReload,
  profile
}: {
  actions?: OperationalUserProfileActions;
  onClose: () => void;
  onReload: () => void;
  profile: OperationalProfileResponse;
}) {
  const user = profile.user;
  const whatsappHref = `https://wa.me/${normalizePhoneForWhatsapp(user.phoneNumber)}`;

  return (
    <>
      <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-orange-50 text-orange-700 ring-1 ring-orange-100">
              <UserRound className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
                  {formatEnum(user.role)}
                </Badge>
                <Badge variant="muted">{formatEnum(user.accountStatus)}</Badge>
                <Badge variant="outline">{formatEnum(user.employmentStatus)}</Badge>
              </div>
              <h2 className="truncate text-2xl font-semibold tracking-normal text-slate-950">
                {user.nameEn}
              </h2>
              <p className="truncate text-sm text-slate-500">
                {profile.currentPickerAssignment?.vendor?.vendorName ??
                  profile.champAssignments[0]?.vendor?.vendorName ??
                  "SuperNova profile"}
              </p>
            </div>
          </div>
          <Button
            aria-label="Close user profile"
            className="h-11 w-11 rounded-2xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={<MessageCircle className="h-4 w-4" />} label="Phone" value={user.phoneNumber}>
              <a
                aria-label="Open WhatsApp chat"
                className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                href={whatsappHref}
                rel="noreferrer"
                target="_blank"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </MetricCard>
            <MetricCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Worked days"
              value={profile.workedDays === null ? "Not set" : String(profile.workedDays)}
            />
            <MetricCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Profile"
              value={formatEnum(user.profileStatus)}
            />
          </div>

          <PasswordPanel onReload={onReload} profile={profile} />

          <ProfileActions actions={actions} user={user} />

          {profile.permissions.canEditProfile ? (
            <AdminEditPanel onReload={onReload} user={user} />
          ) : (
            <ReadOnlyDetails profile={profile} />
          )}

          <ActivityPanel profile={profile} />
        </div>
      </div>
    </>
  );
}

function PasswordPanel({
  profile
}: {
  onReload: () => void;
  profile: OperationalProfileResponse;
}) {
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordExpiresAt, setTemporaryPasswordExpiresAt] = useState<
    string | null
  >(profile.password.temporaryPasswordExpiresAt);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const user = profile.user;
  const expiresAt = profile.password.temporaryPasswordExpiresAt
    ? new Date(profile.password.temporaryPasswordExpiresAt).getTime()
    : null;
  const temporaryPasswordExpired =
    expiresAt !== null && expiresAt <= Date.now();
  const canReveal =
    profile.password.mustChangePassword &&
    profile.password.temporaryPasswordAvailable &&
    profile.permissions.canReadTemporaryPassword &&
    !temporaryPasswordExpired;
  const canReset =
    profile.permissions.canResetPassword ||
    profile.permissions.canRegenerateTemporaryPassword;

  useEffect(() => {
    if (!canReveal) {
      setTemporaryPassword("");
    }
    setTemporaryPasswordExpiresAt(
      canReveal ? profile.password.temporaryPasswordExpiresAt : null
    );
  }, [canReveal, profile.password.temporaryPasswordExpiresAt]);

  function revealTemporaryPassword() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await usersApi.revealTemporaryPassword(user.id);
        setTemporaryPassword(response.temporaryPassword);
        setTemporaryPasswordExpiresAt(response.temporaryPasswordExpiresAt);
        setMessage("Temporary password revealed.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to reveal temporary password."
        );
      }
    });
  }

  function resetTemporaryPassword() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await usersApi.resetTemporaryPassword(user.id);
        setTemporaryPassword(response.temporaryPassword);
        setTemporaryPasswordExpiresAt(response.temporaryPasswordExpiresAt);
        setMessage("Temporary password reset. Share it from this profile only.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to reset temporary password."
        );
      }
    });
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setMessage("Temporary password copied.");
    } catch {
      setError("Unable to copy temporary password.");
    }
  }

  if (
    !profile.permissions.canResetPassword &&
    !profile.permissions.canRegenerateTemporaryPassword &&
    !profile.permissions.canReadTemporaryPassword
  ) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Password access</h3>
          <p className="mt-1 text-sm text-slate-500">
            {canReveal
              ? "Temporary password can be revealed only while the user must change it."
              : profile.password.mustChangePassword
                ? "Temporary password is unavailable or expired. Reset to issue a new one."
              : "Reset creates a temporary password and requires change on next login."}
          </p>
          {temporaryPasswordExpiresAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Available until {new Date(temporaryPasswordExpiresAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <KeyRound className="h-5 w-5 text-orange-600" />
      </div>
      {temporaryPassword ? (
        <div className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <Input
              className="h-11 rounded-xl font-mono"
              readOnly
              value={temporaryPassword}
            />
            <Button
              aria-label="Copy temporary password"
              className="h-11 w-11 rounded-xl p-0"
              disabled={isPending}
              onClick={() => void copyTemporaryPassword()}
              type="button"
              variant="outline"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {canReset ? (
            <Button
              className="h-11 rounded-xl"
              disabled={isPending}
              onClick={resetTemporaryPassword}
              type="button"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset temporary password
            </Button>
          ) : null}
        </div>
      ) : canReveal ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button
            className="h-11 rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
            disabled={isPending}
            onClick={revealTemporaryPassword}
            type="button"
            variant="outline"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Reveal temporary password
          </Button>
          {canReset ? (
            <Button
              className="h-11 rounded-xl"
              disabled={isPending}
              onClick={resetTemporaryPassword}
              type="button"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset temporary password
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          className="mt-4 h-11 rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
          disabled={isPending || !canReset}
          onClick={resetTemporaryPassword}
          type="button"
          variant="outline"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Reset temporary password
        </Button>
      )}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function ProfileActions({
  actions,
  user
}: {
  actions?: OperationalUserProfileActions;
  user: SafeUser;
}) {
  if (user.role !== "PICKER" || !actions) {
    return null;
  }

  return (
    <section className="grid gap-2 sm:grid-cols-2">
      <ActionButton
        icon={<ArrowRightLeft className="h-4 w-4" />}
        label="Transfer"
        onClick={() => actions.onTransfer?.(user)}
        tone="blue"
      />
      <ActionButton
        icon={<UserMinus className="h-4 w-4" />}
        label="Resignation"
        onClick={() => actions.onResignation?.(user)}
        tone="amber"
      />
    </section>
  );
}

function AdminEditPanel({
  onReload,
  user
}: {
  onReload: () => void;
  user: SafeUser;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateAdminProfileInput>(() => toEditForm(user));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(toEditForm(user));
  }, [user]);

  function updateField<Key extends keyof UpdateAdminProfileInput>(
    key: Key,
    value: UpdateAdminProfileInput[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await usersApi.updateAdminProfile(user.id, form);
        setEditing(false);
        onReload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to save profile."
        );
      }
    });
  }

  if (!editing) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">Profile data</h3>
          <Button
            className="h-10 rounded-xl"
            onClick={() => setEditing(true)}
            type="button"
            variant="outline"
          >
            <Edit3 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
        <ProfileRows user={user} />
      </section>
    );
  }

  return (
    <form className="rounded-2xl border border-orange-200 bg-orange-50/30 p-4" onSubmit={onSubmit}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">Edit safe profile fields</h3>
        <Button
          className="h-10 rounded-xl"
          onClick={() => setEditing(false)}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditField label="English name" value={form.nameEn ?? ""} onChange={(value) => updateField("nameEn", value)} />
        <EditField label="Arabic name" value={form.nameAr ?? ""} onChange={(value) => updateField("nameAr", value)} />
        <EditField label="Phone" value={form.phoneNumber ?? ""} onChange={(value) => updateField("phoneNumber", value)} />
        <EditField label="National ID" value={form.nationalId ?? ""} onChange={(value) => updateField("nationalId", value)} />
        <EditField label="Shopper ID" value={form.shopperId ?? ""} onChange={(value) => updateField("shopperId", value)} />
        <EditField label="IBS ID" value={form.ibsId ?? ""} onChange={(value) => updateField("ibsId", value)} />
        <EditField label="Date of birth" type="date" value={form.dateOfBirth ?? ""} onChange={(value) => updateField("dateOfBirth", value)} />
        <EditField label="Joining date" type="date" value={form.joiningDate ?? ""} onChange={(value) => updateField("joiningDate", value)} />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Gender
          <Select
            aria-label="Gender"
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
            onChange={(event) => updateField("gender", event.target.value as SafeUser["gender"])}
            value={form.gender ?? "UNSPECIFIED"}
          >
            <option value="UNSPECIFIED">Unspecified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
          Address
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => updateField("address", event.target.value)}
            value={form.address ?? ""}
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <Button
        className="mt-4 h-11 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save profile
      </Button>
    </form>
  );
}

function ReadOnlyDetails({ profile }: { profile: OperationalProfileResponse }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">Profile data</h3>
      <ProfileRows user={profile.user} />
    </section>
  );
}

function ActivityPanel({ profile }: { profile: OperationalProfileResponse }) {
  const items = profile.activity.length
    ? profile.activity
    : profile.recentRequests.map((request) => ({
        id: request.id,
        action: request.type,
        entityType: "Request",
        entityId: request.id,
        actor: null,
        createdAt: request.createdAt
      }));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">Recent activity</h3>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <div className="flex gap-3 rounded-xl bg-slate-50 p-3" key={item.id}>
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">
                  {formatEnum(item.action)}
                </p>
                <p className="text-xs text-slate-500">
                  {item.actor?.nameEn ?? item.entityType} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            No recent activity yet.
          </p>
        )}
      </div>
    </section>
  );
}

function ProfileShell({
  children,
  onClose,
  title
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <Button aria-label={`Close ${title}`} className="h-10 w-10 rounded-xl p-0" onClick={onClose} variant="outline">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </>
  );
}

function CenteredState({
  action,
  icon,
  label
}: {
  action?: ReactNode;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl bg-slate-50 p-6 text-center">
      <div>
        {icon ? <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white text-orange-600">{icon}</div> : null}
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function MetricCard({
  children,
  icon,
  label,
  value
}: {
  children?: ReactNode;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
          {icon}
          {label}
        </div>
        <p className="truncate text-base font-semibold text-slate-950">{value}</p>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  tone
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  tone: "blue" | "amber" | "red";
}) {
  return (
    <Button
      className={cn(
        "h-12 rounded-2xl border bg-white",
        tone === "blue" && "border-blue-200 text-blue-700 hover:bg-blue-50",
        tone === "amber" && "border-amber-200 text-amber-700 hover:bg-amber-50",
        tone === "red" && "border-red-200 text-red-700 hover:bg-red-50"
      )}
      disabled={!onClick}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  );
}

function ProfileRows({ user }: { user: SafeUser }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <ProfileRow label="English name" value={user.nameEn} />
      <ProfileRow label="Arabic name" value={user.nameAr ?? "Not set"} />
      <ProfileRow label="Shopper ID" value={user.shopperId ?? "Not set"} />
      <ProfileRow label="IBS ID" value={user.ibsId ?? "Not set"} />
      <ProfileRow label="National ID" value={user.nationalId ?? "Not set"} />
      <ProfileRow label="Gender" value={formatEnum(user.gender)} />
      <ProfileRow label="Date of birth" value={formatDate(user.dateOfBirth)} />
      <ProfileRow label="Joining date" value={formatDate(user.joiningDate)} />
      <ProfileRow label="Last login" value={formatDateTime(user.lastLoginAt)} />
      <ProfileRow label="Block status" value={formatEnum(user.blockStatus)} />
      <ProfileRow className="sm:col-span-2" label="Address" value={user.address ?? "Not set"} />
    </div>
  );
}

function ProfileRow({
  className,
  label,
  value
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50 px-3 py-2", className)}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function EditField({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input
        className="h-11 rounded-xl bg-white"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function toEditForm(user: SafeUser): UpdateAdminProfileInput {
  return {
    nameEn: user.nameEn,
    nameAr: user.nameAr ?? "",
    phoneNumber: user.phoneNumber,
    nationalId: user.nationalId ?? "",
    address: user.address ?? "",
    dateOfBirth: toDateInput(user.dateOfBirth),
    gender: user.gender,
    joiningDate: toDateInput(user.joiningDate),
    shopperId: user.shopperId ?? "",
    ibsId: user.ibsId ?? ""
  };
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function normalizePhoneForWhatsapp(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  return digits;
}
