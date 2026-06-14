"use client";

import {
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Edit3,
  GitBranch,
  Infinity as InfinityIcon,
  KeyRound,
  Loader2,
  MessageCircle,
  MinusCircle,
  MoreHorizontal,
  Plus,
  Search,  Trash2,
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

import { parseOffboardingPayload } from "@/components/requests/shared/request-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { DetailPanelSkeleton, Skeleton } from "@/components/ui/skeleton";
import {
  deductionsApi,
  isDeductionTargetRole,
  type DeductionListResponse
} from "@/lib/api/deductions";
import { organizationApi, type Chain } from "@/lib/api/organization";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";
import {
  usersApi,
  type AnnualLeaveBalance,
  type AnnualLeaveEligibilityStatus,
  type AreaManagerChainAssignmentsResponse,
  type OperationalProfileAssignment,
  type OperationalProfileResponse
} from "@/lib/api/users";
import type { SafeUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import {
  currentMonthValue,
  DeductionStatusBadge,
  formatDeductionDays,
  formatOrdinal
} from "@/components/deductions/deduction-format";
import { AdminProfileEditDialog } from "./admin-profile-edit-dialog";
import { PasswordAccessDialog } from "./password-access-dialog";
import { PickerProfileOverview } from "./picker-profile-overview";
import { UserAvatar } from "./user-avatar";
import { UserRequestDetailModal } from "./user-request-detail-modal";
import {
  formatDate,
  formatDateTime,
  formatEnum,
  getPrimaryAssignmentLabel,
  getProfileOperationalStatus,
  normalizePhoneForWhatsapp,
  type UserOperationalStatus
} from "./users-display-utils";

type LoadState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: OperationalProfileResponse; error?: never };

export interface OperationalUserProfileActions {
  onTransfer?: (user: SafeUser, profile?: OperationalProfileResponse) => void;
  onResignation?: (user: SafeUser, profile?: OperationalProfileResponse) => void;
  onDeduction?: (user: SafeUser, profile?: OperationalProfileResponse) => void;
}

export function OperationalUserProfileModal({
  actions,
  allowDirectProfileMutation = true,
  onClose,
  onUpdated,
  userId
}: {
  actions?: OperationalUserProfileActions;
  allowDirectProfileMutation?: boolean;
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
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[140] grid place-items-center bg-[rgba(65,21,23,0.45)] p-2 sn-dialog-overlay-in sm:p-4"
        role="dialog"
      >
        <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] shadow-2xl sn-dialog-panel-in">
          {state.status === "loading" ? (
            <ProfileShell title="Loading profile" onClose={onClose}>
              <DetailPanelSkeleton
                className="border-0 shadow-none"
                label="Loading profile"
              />
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
              allowDirectProfileMutation={allowDirectProfileMutation}
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
    </ModalPortal>
  );
}

function ProfileContent({
  actions,
  allowDirectProfileMutation,
  onClose,
  onReload,
  profile
}: {
  actions?: OperationalUserProfileActions;
  allowDirectProfileMutation: boolean;
  onClose: () => void;
  onReload: () => void;
  profile: OperationalProfileResponse;
}) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const user = profile.user;
  const whatsappHref = `https://wa.me/${normalizePhoneForWhatsapp(user.phoneNumber)}`;
  const operationalStatus = getProfileOperationalStatus(profile);

  return (
    <>
      <div className="border-b border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <UserAvatar
              accountStatus={user.accountStatus}
              employmentStatus={user.employmentStatus}
              name={user.nameEn}
              role={user.role}
              size="lg"
              statusTone={operationalStatus.tone}
            />
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge className="rounded-full border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]" variant="outline">
                  {formatEnum(user.role)}
                </Badge>
                <OperationalStatusBadge status={operationalStatus} />
              </div>
              <h2 className="truncate text-xl font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-2xl">
                {user.nameEn}
              </h2>
              <p className="truncate text-sm text-[color:var(--sn-muted)]">
                {getPrimaryAssignmentLabel(profile)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ProfileHeaderActions
              allowDirectProfileMutation={allowDirectProfileMutation}
              actions={actions}
              onEdit={
                profile.permissions.canEditProfile
                  ? () => setEditOpen(true)
                  : undefined
              }
              onPassword={() => setPasswordOpen(true)}
              profile={profile}
            />
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--sn-sunken)] p-3 sm:p-5">
        {user.role === "CHAMP" ? (
          <ChampProfileCard
            profile={profile}
            whatsappHref={whatsappHref}
          />
        ) : user.role === "AREA_MANAGER" ? (
          <AreaManagerProfileCard
            allowDirectAssignmentEditing={allowDirectProfileMutation}
            onReload={onReload}
            profile={profile}
            whatsappHref={whatsappHref}
          />
        ) : (
          <PickerProfileCard
            profile={profile}
            whatsappHref={whatsappHref}
          />
        )}
      </div>

      {passwordOpen ? (
        <PasswordAccessDialog
          onClose={() => setPasswordOpen(false)}
          profile={profile}
        />
      ) : null}

      {editOpen ? (
        <AdminProfileEditDialog
          onClose={() => setEditOpen(false)}
          onSaved={onReload}
          user={user}
        />
      ) : null}
    </>
  );
}

function ProfileHeaderActions({
  allowDirectProfileMutation,
  actions,
  onEdit,
  onPassword,
  profile
}: {
  allowDirectProfileMutation: boolean;
  actions?: OperationalUserProfileActions;
  onEdit?: () => void;
  onPassword: () => void;
  profile: OperationalProfileResponse;
}) {
  const [open, setOpen] = useState(false);
  const user = profile.user;
  const canTransfer = user.role === "PICKER" && Boolean(actions?.onTransfer);
  const canResign =
    (user.role === "PICKER" ||
      user.role === "CHAMP" ||
      user.role === "AREA_MANAGER") &&
    Boolean(actions?.onResignation);
  const canDeduct =
    isDeductionTargetRole(user.role) && Boolean(actions?.onDeduction);
  const canEdit =
    allowDirectProfileMutation &&
    profile.permissions.canEditProfile &&
    Boolean(onEdit);
  const canPassword =
    allowDirectProfileMutation && hasPasswordAccess(profile);

  if (!canTransfer && !canResign && !canDeduct && !canEdit && !canPassword) {
    return null;
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open profile actions"
        className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)] transition hover:border-[#FFD8BD] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-1 shadow-xl motion-safe:animate-[sn-dialog-panel-in_140ms_ease-out_both]">
          {canEdit ? (
            <HeaderMenuAction
              icon={<Edit3 className="h-4 w-4" />}
              label="Edit profile"
              onClick={() => {
                setOpen(false);
                onEdit?.();
              }}
              tone="slate"
            />
          ) : null}
          {canTransfer ? (
            <HeaderMenuAction
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Transfer"
              onClick={() => {
                setOpen(false);
                actions?.onTransfer?.(user, profile);
              }}
              tone="blue"
            />
          ) : null}
          {canDeduct ? (
            <HeaderMenuAction
              icon={<MinusCircle className="h-4 w-4" />}
              label="Add deduction"
              onClick={() => {
                setOpen(false);
                actions?.onDeduction?.(user, profile);
              }}
              tone="amber"
            />
          ) : null}
          {canResign ? (
            <HeaderMenuAction
              icon={<UserMinus className="h-4 w-4" />}
              label="Resign"
              onClick={() => {
                setOpen(false);
                actions?.onResignation?.(user, profile);
              }}
              tone="red"
            />
          ) : null}
          {canPassword ? (
            <HeaderMenuAction
              icon={<KeyRound className="h-4 w-4" />}
              label="Password"
              onClick={() => {
                setOpen(false);
                onPassword();
              }}
              tone="slate"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HeaderMenuAction({
  icon,
  label,
  onClick,
  tone
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "amber" | "blue" | "red" | "slate";
}) {
  return (
    <button
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]",
        tone === "amber" && "text-[oklch(0.62_0.13_70)] hover:bg-[oklch(0.95_0.05_80)]",
        tone === "blue" && "text-[color:var(--tlb-purple)] hover:bg-[color:var(--sn-sunken)]",
        tone === "red" && "text-[oklch(0.55_0.19_27)] hover:bg-[oklch(0.95_0.035_27)]",
        tone === "slate" && "text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)]"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function OperationalStatusBadge({
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

function PickerProfileCard({
  profile,
  whatsappHref
}: {
  profile: OperationalProfileResponse;
  whatsappHref: string;
}) {
  const [tab, setTab] = useState<
    "overview" | "requests" | "deductions" | "activity"
  >("overview");

  return (
    <div className="grid gap-4">
      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "requests", label: "Related Requests" },
          { id: "deductions", label: "Deductions" },
          { id: "activity", label: "Recent Activity" }
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-4">
          <PickerProfileOverview profile={profile} whatsappHref={whatsappHref} />
          <AnnualLeaveBalanceCard balance={profile.annualLeaveBalance} />
          <ResignationStatusSection profile={profile} />
          <ReadOnlyDetails profile={profile} />
        </div>
      ) : tab === "requests" ? (
        <RelatedRequestsPanel profile={profile} />
      ) : tab === "deductions" ? (
        <UserDeductionsPanel userId={profile.user.id} />
      ) : (
        <ActivityPanel profile={profile} />
      )}
    </div>
  );
}

function ChampProfileCard({
  profile,
  whatsappHref
}: {
  profile: OperationalProfileResponse;
  whatsappHref: string;
}) {
  const [tab, setTab] = useState<
    "overview" | "branches" | "deductions" | "log"
  >("overview");

  return (
    <div className="grid gap-4">
      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "branches", label: "Branches" },
          { id: "deductions", label: "Deductions" },
          { id: "log", label: "Champ Log" }
        ]}
      />
      {tab === "overview" ? (
        <div className="grid gap-4">
          <ProfileSummaryPanel profile={profile} whatsappHref={whatsappHref} />
          <AnnualLeaveBalanceCard balance={profile.annualLeaveBalance} />
          <ReadOnlyDetails profile={profile} />
        </div>
      ) : tab === "branches" ? (
        <AssignmentList
          assignments={profile.champAssignments}
          emptyLabel="No active or historical Branch assignments found."
          title="Branch assignments"
        />
      ) : tab === "deductions" ? (
        <UserDeductionsPanel userId={profile.user.id} />
      ) : (
        <ActivityPanel profile={profile} title="Champ Log" />
      )}
    </div>
  );
}

function AreaManagerProfileCard({
  allowDirectAssignmentEditing,
  onReload,
  profile,
  whatsappHref
}: {
  allowDirectAssignmentEditing: boolean;
  onReload: () => void;
  profile: OperationalProfileResponse;
  whatsappHref: string;
}) {
  const [tab, setTab] = useState<"overview" | "chains" | "log">("overview");

  return (
    <div className="grid gap-4">
      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "chains", label: "Chains" },
          { id: "log", label: "Manager Log" }
        ]}
      />
      {tab === "overview" ? (
        <div className="grid gap-4">
          <ProfileSummaryPanel profile={profile} whatsappHref={whatsappHref} />
          <AnnualLeaveBalanceCard balance={profile.annualLeaveBalance} />
          <ReadOnlyDetails profile={profile} />
        </div>
      ) : tab === "chains" ? (
        profile.permissions.canEditProfile && allowDirectAssignmentEditing ? (
          <AreaManagerChainAssignmentManager
            onReload={onReload}
            profile={profile}
          />
        ) : (
          <AssignmentList
            assignments={profile.areaManagerAssignments}
            emptyLabel="No active or historical Chain assignments found."
            title="Chain assignments"
          />
        )
      ) : (
        <ActivityPanel profile={profile} title="Manager Log" />
      )}
    </div>
  );
}

function AreaManagerChainAssignmentManager({
  onReload,
  profile
}: {
  onReload: () => void;
  profile: OperationalProfileResponse;
}) {
  const [data, setData] = useState<AreaManagerChainAssignmentsResponse | null>({
    user: profile.user,
    assignments: profile.areaManagerAssignments
  });
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadAssignments() {
    try {
      setError(null);
      setData(await usersApi.areaManagerChainAssignments(profile.user.id));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load Chain assignments."
      );
    }
  }

  useEffect(() => {
    void loadAssignments();
  }, [profile.user.id]);

  const assignments = data?.assignments ?? [];
  const assignedChainIds = assignments.map((assignment) => assignment.chain.id);

  function removeAssignment(assignment: AreaManagerChainAssignmentsResponse["assignments"][number]) {
    const confirmed = window.confirm(
      `Remove ${assignment.chain.chainName} from this Area Manager?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setRemovingId(assignment.id);
    startTransition(async () => {
      try {
        setData(
          await usersApi.removeAreaManagerChainAssignment(
            profile.user.id,
            assignment.id
          )
        );
        onReload();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to remove Chain assignment."
        );
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">
            Chain assignments
          </h3>
          <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
            Area Manager operating scope is controlled from this profile.
          </p>
        </div>
        <Button
          className="h-10 rounded-xl bg-[color:var(--tlb-orange)] text-white hover:bg-[#E85100]"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Chain
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] p-3 text-sm text-[oklch(0.55_0.19_27)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        {assignments.length ? (
          assignments.map((assignment) => (
            <div
              className="flex flex-col gap-3 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 sm:flex-row sm:items-center sm:justify-between"
              key={assignment.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--sn-card)] text-[color:var(--tlb-orange)] shadow-sm">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
                    {assignment.chain.chainName}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                    {assignment.chain.chainCode} · {formatEnum(assignment.chain.status)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                    Start {formatDate(assignment.startDate)}
                  </p>
                </div>
              </div>
              <Button
                className="h-10 rounded-xl border-[oklch(0.88_0.06_27)] text-[oklch(0.55_0.19_27)] hover:bg-[oklch(0.95_0.035_27)] sm:w-auto"
                disabled={isPending && removingId === assignment.id}
                onClick={() => removeAssignment(assignment)}
                type="button"
                variant="outline"
              >
                {isPending && removingId === assignment.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 text-sm text-[color:var(--sn-muted)]">
            No Chains assigned yet. Add Chains from this profile.
          </p>
        )}
      </div>

      {addOpen ? (
        <AddAreaManagerChainsDialog
          assignedChainIds={assignedChainIds}
          onClose={() => setAddOpen(false)}
          onSaved={(response) => {
            setData(response);
            setAddOpen(false);
            onReload();
          }}
          userId={profile.user.id}
        />
      ) : null}
    </section>
  );
}

function AddAreaManagerChainsDialog({
  assignedChainIds,
  onClose,
  onSaved,
  userId
}: {
  assignedChainIds: string[];
  onClose: () => void;
  onSaved: (response: AreaManagerChainAssignmentsResponse) => void;
  userId: string;
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const assigned = new Set(assignedChainIds);
  const selectableChains = chains.filter((chain) => !assigned.has(chain.id));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      organizationApi
        .listChains({
          page: 1,
          pageSize: 100,
          q: query.trim() || undefined,
          status: "ACTIVE"
        })
        .then((response) => {
          if (alive) {
            setChains(response.items);
            setError(null);
          }
        })
        .catch((caughtError) => {
          if (alive) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Chains."
            );
          }
        })
        .finally(() => {
          if (alive) {
            setLoading(false);
          }
        });
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  function toggle(chainId: string) {
    setSelectedIds((current) =>
      current.includes(chainId)
        ? current.filter((id) => id !== chainId)
        : [...current, chainId]
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedIds.length) {
      setError("Select at least one Chain.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        onSaved(await usersApi.addAreaManagerChainAssignments(userId, selectedIds));
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to add Chain assignments."
        );
      }
    });
  }

  return (
    <ModalPortal>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[220] grid place-items-center bg-[rgba(65,21,23,0.45)] p-3"
        role="dialog"
      >
        <form
          className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] shadow-2xl"
          onSubmit={submit}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--sn-border)] p-4">
            <div>
              <h3 className="text-base font-semibold text-[color:var(--sn-ink)]">Add Chains</h3>
              <p className="text-sm text-[color:var(--sn-muted)]">
                Select one or more active Chains.
              </p>
            </div>
            <Button
              aria-label="Close Add Chains"
              className="h-10 w-10 rounded-xl p-0"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--sn-muted)]" />
              <Input
                className="h-11 rounded-xl pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Chain name or code"
                value={query}
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] p-3 text-sm text-[oklch(0.55_0.19_27)]">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-2">
              {loading ? (
                <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
                  Loading Chains...
                </p>
              ) : selectableChains.length ? (
                selectableChains.map((chain) => {
                  const selected = selectedIds.includes(chain.id);
                  return (
                    <button
                      className={cn(
                        "flex min-h-14 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition",
                        selected
                          ? "border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
                          : "border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)] hover:border-[#FFD8BD]"
                      )}
                      key={chain.id}
                      onClick={() => toggle(chain.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {chain.chainName}
                        </span>
                        <span className="mt-1 block text-xs text-[color:var(--sn-muted)]">
                          {chain.chainCode} · {formatEnum(chain.status)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                          selected
                            ? "border-[#FFD8BD] bg-[color:var(--tlb-orange)] text-white"
                            : "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]"
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
                  No active unassigned Chains found.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4 sm:flex-row sm:justify-end">
            <Button
              className="h-11 rounded-xl"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-[color:var(--tlb-orange)] text-white hover:bg-[#E85100]"
              disabled={isPending || !selectedIds.length}
              type="submit"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Selected
            </Button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function ProfileSummaryPanel({
  profile,
  whatsappHref
}: {
  profile: OperationalProfileResponse;
  whatsappHref: string;
}) {
  const user = profile.user;

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">Overview</h3>
      </div>
      <div className="mt-4 divide-y divide-[color:var(--sn-border)] overflow-hidden rounded-2xl border border-[color:var(--sn-border)]">
        <InfoRow
          icon={<MessageCircle className="h-4 w-4" />}
          label="Phone"
          value={user.phoneNumber}
          action={
            <a
              aria-label="Open WhatsApp chat"
              className="grid h-10 w-10 place-items-center rounded-xl border border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)] transition hover:-translate-y-0.5 hover:bg-[oklch(0.88_0.06_150)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.58_0.13_150)] active:scale-[0.96]"
              href={whatsappHref}
              rel="noreferrer"
              target="_blank"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          }
        />
        <InfoRow
          icon={<CalendarDays className="h-4 w-4" />}
          label="Worked days"
          value={profile.workedDays === null ? "Not set" : String(profile.workedDays)}
        />
        <InfoRow
          icon={<UserRound className="h-4 w-4" />}
          label="Current assignment"
          value={getPrimaryAssignmentLabel(profile)}
        />
      </div>
    </section>
  );
}

function InfoRow({
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
    <div className="flex flex-col gap-3 bg-[color:var(--sn-card)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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

function AnnualLeaveBalanceCard({ balance }: { balance: AnnualLeaveBalance }) {
  // Picker/Champ only — Area Manager / Admin / Super Admin render nothing.
  if (balance.eligibilityStatus === "NOT_APPLICABLE") {
    return null;
  }

  const eligible = balance.eligibilityStatus === "ELIGIBLE";

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">
          Annual Leave Balance
        </h3>
        <AnnualLeaveStatusBadge status={balance.eligibilityStatus} />
      </div>

      {balance.eligibilityStatus === "MISSING_JOINING_DATE" ? (
        <p className="mt-3 text-sm text-[color:var(--sn-muted)]">
          {balance.message}
        </p>
      ) : eligible ? (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AnnualLeaveStat
              label="Carried (max 7)"
              value={`${formatDays(balance.carriedBalanceDays)} d`}
            />
            <AnnualLeaveStat
              label={`Accrued ${balance.year}`}
              value={`${formatDays(balance.currentYearAccruedDays)} d`}
            />
            <AnnualLeaveStat
              label="Taken this year"
              value={`${formatDays(balance.annualTakenThisYear)} d`}
            />
          </div>
          <div className="rounded-2xl border border-[oklch(0.88_0.06_150)] bg-[oklch(0.97_0.02_150)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[oklch(0.45_0.1_150)]">
              Remaining balance
            </p>
            <p className="mt-1 text-2xl font-semibold text-[oklch(0.42_0.12_150)]">
              {balance.remainingDays === null
                ? "—"
                : `${formatDays(balance.remainingDays)} days`}
            </p>
          </div>
          <p className="text-xs text-[color:var(--sn-muted)]">{balance.message}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-[color:var(--sn-body)]">{balance.message}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AnnualLeaveStat
              label="Eligible from"
              value={balance.eligibleFrom ? formatDate(balance.eligibleFrom) : "—"}
            />
            <AnnualLeaveStat
              label="Accrued preview"
              value={`${formatDays(balance.accruedPreviewDays)} d`}
            />
            <AnnualLeaveStat
              label="Taken this year"
              value={`${formatDays(balance.annualTakenThisYear)} d`}
            />
          </div>
        </div>
      )}

      {balance.attendanceCoverageFrom && balance.attendanceCoverageTo ? (
        <p className="mt-3 text-[11px] text-[color:var(--sn-faint)]">
          Based on attendance {formatDate(balance.attendanceCoverageFrom)} –{" "}
          {formatDate(balance.attendanceCoverageTo)}
        </p>
      ) : null}
    </section>
  );
}

function AnnualLeaveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-[color:var(--sn-muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-[color:var(--sn-ink)]">
        {value}
      </p>
    </div>
  );
}

function AnnualLeaveStatusBadge({
  status
}: {
  status: AnnualLeaveEligibilityStatus;
}) {
  const tone =
    status === "ELIGIBLE"
      ? "border-[oklch(0.88_0.06_150)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.45_0.1_150)]"
      : status === "NOT_ELIGIBLE"
        ? "border-[oklch(0.85_0.07_70)] bg-[oklch(0.96_0.04_70)] text-[oklch(0.5_0.12_70)]"
        : "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]";
  const label =
    status === "ELIGIBLE"
      ? "Eligible"
      : status === "NOT_ELIGIBLE"
        ? "Not eligible yet"
        : "No joining date";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone
      )}
    >
      {label}
    </span>
  );
}

function formatDays(value: number) {
  return `${Number(value.toFixed(2))}`;
}

function ProfileTabs<TabId extends string>({
  active,
  onChange,
  tabs
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
  tabs: Array<{ id: TabId; label: string }>;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-1",
        tabs.length === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : tabs.length === 3
            ? "grid-cols-3"
            : "grid-cols-2"
      )}
    >
      {tabs.map((tab) => (
        <button
          aria-selected={active === tab.id}
          className={cn(
            "min-h-11 min-w-0 rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)] sm:text-sm",
            active === tab.id
              ? "bg-[color:var(--sn-card)] text-[color:var(--tlb-orange-900)] shadow-sm ring-1 ring-[#FFD8BD]"
              : "text-[color:var(--sn-body)] hover:bg-[color:var(--sn-card)]/80 hover:text-[color:var(--sn-ink)]"
          )}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function AssignmentList({
  assignments,
  emptyLabel,
  title
}: {
  assignments: OperationalProfileAssignment[];
  emptyLabel: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {assignments.length ? (
          assignments.map((assignment) => (
            <div className="rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3" key={assignment.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
                  {assignment.vendor?.vendorName ?? assignment.chain.chainName}
                </p>
                <Badge variant={assignment.status === "ACTIVE" ? "muted" : "outline"}>
                  {formatEnum(assignment.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                {assignment.vendor ? `${assignment.chain.chainName} · ` : ""}
                Start {formatDate(assignment.startDate)}
                {assignment.endDate ? ` · End ${formatDate(assignment.endDate)}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function ResignationStatusSection({
  profile
}: {
  profile: OperationalProfileResponse;
}) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const user = profile.user;
  const resignationRequest = profile.recentRequests.find(
    (request) => request.type === "RESIGNATION"
  );
  const visible =
    user.employmentStatus === "RESIGNED" ||
    user.employmentStatus === "ARCHIVED" ||
    user.accountStatus === "ARCHIVED" ||
    user.blockStatus !== "NO_BLOCK";

  useEffect(() => {
    if (!visible || !resignationRequest) {
      return;
    }

    let alive = true;
    requestsApi
      .get(resignationRequest.id)
      .then((request) => {
        if (alive) setDetail(request);
      })
      .catch(() => {
        if (alive) setDetail(null);
      });

    return () => {
      alive = false;
    };
  }, [resignationRequest?.id, visible]);

  if (!visible) {
    return null;
  }

  const payload = detail ? parseOffboardingPayload(detail.payload) : null;

  return (
    <section className="rounded-2xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.97_0.018_27)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[oklch(0.35_0.15_27)]">Lifecycle state</h3>
        <Badge className="rounded-full border-[oklch(0.88_0.06_27)] bg-[color:var(--sn-card)] text-[oklch(0.55_0.19_27)]" variant="outline">
          {formatEnum(user.employmentStatus)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <LifecycleField
          label="Resignation date"
          value={formatDate(user.resignationDate)}
        />
        <LifecycleField
          label="Block status"
          value={formatEnum(user.blockStatus)}
          valueIcon={
            user.blockStatus === "PERMANENT_BLOCK" ? (
              <InfinityIcon className="h-4 w-4" />
            ) : null
          }
        />
        {user.blockStatus === "TEMPORARY_BLOCK" ? (
          <LifecycleField
            label="Blocked until"
            value={formatDate(user.blockedUntil)}
          />
        ) : null}
        {payload?.reason ? (
          <LifecycleField label="Reason" value={payload.reason} />
        ) : null}
        {payload?.reasonDetails ? (
          <LifecycleField
            className="sm:col-span-2"
            label="Reason notes"
            value={payload.reasonDetails}
          />
        ) : null}
      </div>
    </section>
  );
}

function LifecycleField({
  className,
  label,
  value,
  valueIcon
}: {
  className?: string;
  label: string;
  value: string;
  valueIcon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-[oklch(0.88_0.06_27)] bg-[color:var(--sn-card)]/75 p-3", className)}>
      <p className="text-xs font-semibold uppercase text-[oklch(0.65_0.10_27)]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 break-words text-sm font-semibold text-[oklch(0.35_0.15_27)]">
        {value}
        {valueIcon}
      </p>
    </div>
  );
}

function RelatedRequestsPanel({
  profile
}: {
  profile: OperationalProfileResponse;
}) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">Related Requests</h3>
      <div className="mt-3 grid gap-2">
        {profile.recentRequests.length ? (
          profile.recentRequests.map((request) => (
            <article
              className={cn(
                "w-full cursor-pointer rounded-2xl border p-3 text-left transition hover:border-[#FFD8BD] hover:bg-[#FFE8D9]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]",
                isOpenRequest(request.status)
                  ? "border-[#FFD8BD] bg-[#FFE8D9]/50"
                  : "border-[color:var(--sn-border)] bg-[color:var(--sn-card)]"
              )}
              key={request.id}
              onClick={() => setSelectedRequestId(request.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedRequestId(request.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
                    {formatEnum(request.type)}
                  </p>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[color:var(--sn-muted)]">
                    <span>
                      {request.currentStep
                        ? formatEnum(request.currentStep)
                        : "No active step"}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(request.createdAt)}</span>
                    <span>·</span>
                    <span className="max-w-[120px] truncate font-mono">
                      {request.id}
                    </span>
                    <span onClick={(event) => event.stopPropagation()}>
                      <CopyButton
                        aria-label="Copy request ID"
                        className="h-7 w-7 rounded-lg border-0 bg-[color:var(--sn-sunken)] p-0 shadow-none"
                        iconOnly
                        size="sm"
                        text={request.id}
                      />
                    </span>
                  </div>
                </div>
                <Badge variant={isOpenRequest(request.status) ? "outline" : "muted"}>
                  {formatEnum(request.status)}
                </Badge>
              </div>
              <p className="mt-2 truncate text-xs text-[color:var(--sn-muted)]">
                {request.sourceVendor?.vendorName ?? "No source Branch"}
                {request.destinationVendor
                  ? ` -> ${request.destinationVendor.vendorName}`
                  : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
            No related requests found for this user.
          </p>
        )}
      </div>

      {selectedRequestId ? (
        <UserRequestDetailModal
          onClose={() => setSelectedRequestId(null)}
          requestId={selectedRequestId}
        />
      ) : null}
    </section>
  );
}

type UserDeductionsState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: DeductionListResponse; error?: never };

function UserDeductionsPanel({ userId }: { userId: string }) {
  const [month, setMonth] = useState(currentMonthValue);
  const [state, setState] = useState<UserDeductionsState>({
    status: "loading"
  });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });

    deductionsApi
      .list({ month, pageSize: 50, targetUserId: userId })
      .then((data) => {
        if (alive) {
          setState({ data, status: "ready" });
        }
      })
      .catch((caughtError) => {
        if (alive) {
          setState({
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load deductions.",
            status: "error"
          });
        }
      });

    return () => {
      alive = false;
    };
  }, [month, userId]);

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">Deductions</h3>
          {state.status === "ready" ? (
            <p className="mt-1 text-xs font-medium text-[color:var(--sn-muted)]">
              {state.data.summary.effectiveCount} effective ·{" "}
              {formatDeductionDays(Number(state.data.summary.deductionDaysTotal))}{" "}
              days
            </p>
          ) : (
            <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
              Deduction records for the selected month.
            </p>
          )}
        </div>
        <label className="grid min-w-0 gap-1 text-xs font-medium text-[color:var(--sn-body)] sm:w-44">
          <span className="sr-only">Month</span>
          <Input
            aria-label="Deductions month"
            className="h-11 rounded-xl"
            onChange={(event) => setMonth(event.target.value)}
            type="month"
            value={month}
          />
        </label>
      </div>

      <div className="mt-3">
        {state.status === "loading" ? (
          <div aria-busy="true" className="grid gap-2" role="status">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : state.status === "error" ? (
          <p className="rounded-xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] p-3 text-sm text-[oklch(0.55_0.19_27)]">
            {state.error}
          </p>
        ) : state.data.items.length ? (
          <ul className="divide-y divide-[color:var(--sn-border)]">
            {state.data.items.map((item) => (
              <li
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                key={item.id}
              >
                <span className="text-sm font-semibold text-[color:var(--sn-ink)]">
                  {item.actionName}
                </span>
                <Badge
                  className="border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]"
                  variant="outline"
                >
                  {formatOrdinal(item.occurrenceNumber)}
                </Badge>
                <span className="text-sm text-[color:var(--sn-body)]">
                  {item.penaltyLabel}
                </span>
                <DeductionStatusBadge status={item.status} />
                <span className="text-xs font-medium text-[color:var(--sn-muted)]">
                  {formatDate(item.incidentDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
            No deductions for this month.
          </p>
        )}
      </div>
    </section>
  );
}

function ReadOnlyDetails({ profile }: { profile: OperationalProfileResponse }) {
  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">Profile data</h3>
      <ProfileRows user={profile.user} />
    </section>
  );
}

function ActivityPanel({
  profile,
  title = "Recent activity"
}: {
  profile: OperationalProfileResponse;
  title?: string;
}) {
  const [page, setPage] = useState(1);
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
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [profile.user.id]);

  return (
    <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--sn-ink)]">{title}</h3>
          <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
            Latest actions connected to this user.
          </p>
        </div>
        {items.length ? (
          <span className="rounded-full bg-[color:var(--sn-sunken)] px-2.5 py-1 text-xs font-semibold text-[color:var(--sn-muted)] ring-1 ring-[color:var(--sn-border)]">
            {items.length} actions
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {visibleItems.length ? (
          <ol className="relative grid gap-0 before:absolute before:left-4 before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-[color:var(--sn-border)]">
            {visibleItems.map((item) => (
              <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0" key={item.id}>
                <span className="relative z-10 mt-1 grid h-8 w-8 place-items-center rounded-full border border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] shadow-sm">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)]/80 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
                      {formatEnum(item.action)}
                    </p>
                    <time className="shrink-0 text-xs font-medium text-[color:var(--sn-muted)]">
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--sn-muted)]">
                    {item.actor?.nameEn
                      ? `By ${item.actor.nameEn}`
                      : `Recorded on ${formatEnum(item.entityType)}`}
                  </p>
                  <p className="mt-2 truncate font-mono text-[11px] text-[color:var(--sn-faint)]">
                    {item.entityType} · {item.entityId}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl bg-[color:var(--sn-sunken)] p-3 text-sm text-[color:var(--sn-muted)]">
            No recent activity yet.
          </p>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--sn-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-[color:var(--sn-muted)]">
            Page {safePage} of {totalPages}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              className="h-10 rounded-xl"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="outline"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              className="h-10 rounded-xl"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              type="button"
              variant="outline"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
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
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--sn-border)] p-4">
        <h2 className="text-lg font-semibold text-[color:var(--sn-ink)]">{title}</h2>
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
    <div className="grid min-h-48 place-items-center rounded-2xl bg-[color:var(--sn-sunken)] p-6 text-center">
      <div>
        {icon ? <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--sn-card)] text-[color:var(--tlb-orange)]">{icon}</div> : null}
        <p className="text-sm font-medium text-[color:var(--sn-body)]">{label}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function ProfileRows({ user }: { user: SafeUser }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <ProfileRow label="Gender" value={formatEnum(user.gender)} />
      <ProfileRow label="Date of birth" value={formatDate(user.dateOfBirth)} />
      <ProfileRow label="Joining date" value={formatDate(user.joiningDate)} />
      <ProfileRow label="Last login" value={formatDateTime(user.lastLoginAt)} />
      <ProfileRow label="Block status" value={formatEnum(user.blockStatus)} />
      <ProfileRow
        className="sm:col-span-2 xl:col-span-3"
        label="Address"
        value={user.address ?? "Not set"}
      />
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
    <div
      className={cn(
        "flex min-h-[86px] min-w-0 items-start justify-between gap-3 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)]/70 p-3",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-[color:var(--sn-muted)]">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-[color:var(--sn-ink)]">{value}</p>
      </div>
    </div>
  );
}

function hasPasswordAccess(profile: OperationalProfileResponse) {
  return (
    profile.permissions.canResetPassword ||
    profile.permissions.canRegenerateTemporaryPassword ||
    profile.permissions.canReadTemporaryPassword
  );
}

function isOpenRequest(status: string) {
  return status !== "COMPLETED" && status !== "REJECTED" && status !== "CANCELLED";
}
