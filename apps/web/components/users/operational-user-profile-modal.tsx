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
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
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
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import { organizationApi, type Chain } from "@/lib/api/organization";
import { requestsApi, type RequestDetail } from "@/lib/api/requests";
import {
  usersApi,
  type AreaManagerChainAssignmentsResponse,
  type OperationalProfileAssignment,
  type OperationalProfileResponse
} from "@/lib/api/users";
import type { SafeUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
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
        className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-2 sn-dialog-overlay-in sm:p-4"
        role="dialog"
      >
        <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sn-dialog-panel-in">
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
      <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
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
                <Badge className="rounded-full border-orange-200 bg-orange-50 text-orange-700" variant="outline">
                  {formatEnum(user.role)}
                </Badge>
                <OperationalStatusBadge status={operationalStatus} />
              </div>
              <h2 className="truncate text-xl font-semibold tracking-normal text-slate-950 sm:text-2xl">
                {user.nameEn}
              </h2>
              <p className="truncate text-sm text-slate-500">
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-3 sm:p-5">
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
  const canEdit =
    allowDirectProfileMutation &&
    profile.permissions.canEditProfile &&
    Boolean(onEdit);
  const canPassword =
    allowDirectProfileMutation && hasPasswordAccess(profile);

  if (!canTransfer && !canResign && !canEdit && !canPassword) {
    return null;
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open profile actions"
        className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl motion-safe:animate-[sn-dialog-panel-in_140ms_ease-out_both]">
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
  tone: "blue" | "red" | "slate";
}) {
  return (
    <button
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        tone === "blue" && "text-blue-700 hover:bg-blue-50",
        tone === "red" && "text-red-700 hover:bg-red-50",
        tone === "slate" && "text-slate-700 hover:bg-slate-50"
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
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        status.tone === "pending" &&
          "border-amber-200 bg-amber-50 text-amber-700",
        status.tone === "resigned" && "border-red-200 bg-red-50 text-red-700"
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
  const [tab, setTab] = useState<"overview" | "requests" | "activity">("overview");

  return (
    <div className="grid gap-4">
      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "requests", label: "Related Requests" },
          { id: "activity", label: "Recent Activity" }
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-4">
          <PickerProfileOverview profile={profile} whatsappHref={whatsappHref} />
          <ResignationStatusSection profile={profile} />
          <ReadOnlyDetails profile={profile} />
        </div>
      ) : tab === "requests" ? (
        <RelatedRequestsPanel profile={profile} />
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
  const [tab, setTab] = useState<"overview" | "branches" | "log">("overview");

  return (
    <div className="grid gap-4">
      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "branches", label: "Branches" },
          { id: "log", label: "Champ Log" }
        ]}
      />
      {tab === "overview" ? (
        <div className="grid gap-4">
          <ProfileSummaryPanel profile={profile} whatsappHref={whatsappHref} />
          <ReadOnlyDetails profile={profile} />
        </div>
      ) : tab === "branches" ? (
        <AssignmentList
          assignments={profile.champAssignments}
          emptyLabel="No active or historical Branch assignments found."
          title="Branch assignments"
        />
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Chain assignments
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Area Manager operating scope is controlled from this profile.
          </p>
        </div>
        <Button
          className="h-10 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Chain
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        {assignments.length ? (
          assignments.map((assignment) => (
            <div
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              key={assignment.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-orange-600 shadow-sm">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {assignment.chain.chainName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {assignment.chain.chainCode} · {formatEnum(assignment.chain.status)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Start {formatDate(assignment.startDate)}
                  </p>
                </div>
              </div>
              <Button
                className="h-10 rounded-xl border-red-100 text-red-700 hover:bg-red-50 sm:w-auto"
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
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
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
        className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/45 p-3"
        role="dialog"
      >
        <form
          className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onSubmit={submit}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Add Chains</h3>
              <p className="text-sm text-slate-500">
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
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                className="h-11 rounded-xl pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Chain name or code"
                value={query}
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-2">
              {loading ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
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
                          ? "border-orange-300 bg-orange-50 text-orange-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
                      )}
                      key={chain.id}
                      onClick={() => toggle(chain.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {chain.chainName}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {chain.chainCode} · {formatEnum(chain.status)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                          selected
                            ? "border-orange-300 bg-orange-600 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        )}
                      >
                        {selected ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                  No active unassigned Chains found.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <Button
              className="h-11 rounded-xl"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="h-11 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold text-slate-950">Overview</h3>
      </div>
      <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        <InfoRow
          icon={<MessageCircle className="h-4 w-4" />}
          label="Phone"
          value={user.phoneNumber}
          action={
            <a
              aria-label="Open WhatsApp chat"
              className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.96]"
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
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Profile"
          value={formatEnum(user.profileStatus)}
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
    <div className="flex flex-col gap-3 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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
        "grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1",
        tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"
      )}
    >
      {tabs.map((tab) => (
        <button
          aria-selected={active === tab.id}
          className={cn(
            "min-h-11 min-w-0 rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:text-sm",
            active === tab.id
              ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
              : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-2">
        {assignments.length ? (
          assignments.map((assignment) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={assignment.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-950">
                  {assignment.vendor?.vendorName ?? assignment.chain.chainName}
                </p>
                <Badge variant={assignment.status === "ACTIVE" ? "muted" : "outline"}>
                  {formatEnum(assignment.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {assignment.vendor ? `${assignment.chain.chainName} · ` : ""}
                Start {formatDate(assignment.startDate)}
                {assignment.endDate ? ` · End ${formatDate(assignment.endDate)}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
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
    <section className="rounded-2xl border border-red-100 bg-red-50/50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-red-950">Lifecycle state</h3>
        <Badge className="rounded-full border-red-200 bg-white text-red-700" variant="outline">
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
    <div className={cn("rounded-2xl border border-red-100 bg-white/75 p-3", className)}>
      <p className="text-xs font-semibold uppercase text-red-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 break-words text-sm font-semibold text-red-950">
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">Related Requests</h3>
      <div className="mt-3 grid gap-2">
        {profile.recentRequests.length ? (
          profile.recentRequests.map((request) => (
            <article
              className={cn(
                "w-full cursor-pointer rounded-2xl border p-3 text-left transition hover:border-orange-200 hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                isOpenRequest(request.status)
                  ? "border-orange-200 bg-orange-50/50"
                  : "border-slate-200 bg-white"
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
                  <p className="text-sm font-semibold text-slate-950">
                    {formatEnum(request.type)}
                  </p>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500">
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
                        className="h-7 w-7 rounded-lg border-0 bg-slate-50 p-0 shadow-none"
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
              <p className="mt-2 truncate text-xs text-slate-500">
                {request.sourceVendor?.vendorName ?? "No source Branch"}
                {request.destinationVendor
                  ? ` -> ${request.destinationVendor.vendorName}`
                  : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
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

function ReadOnlyDetails({ profile }: { profile: OperationalProfileResponse }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">Profile data</h3>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Latest actions connected to this user.
          </p>
        </div>
        {items.length ? (
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            {items.length} actions
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        {visibleItems.length ? (
          <ol className="relative grid gap-0 before:absolute before:left-4 before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-slate-200">
            {visibleItems.map((item) => (
              <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0" key={item.id}>
                <span className="relative z-10 mt-1 grid h-8 w-8 place-items-center rounded-full border border-orange-200 bg-orange-50 text-orange-700 shadow-sm">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {formatEnum(item.action)}
                    </p>
                    <time className="shrink-0 text-xs font-medium text-slate-500">
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.actor?.nameEn
                      ? `By ${item.actor.nameEn}`
                      : `Recorded on ${formatEnum(item.entityType)}`}
                  </p>
                  <p className="mt-2 truncate font-mono text-[11px] text-slate-400">
                    {item.entityType} · {item.entityId}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            No recent activity yet.
          </p>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
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
        "flex min-h-[86px] min-w-0 items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-slate-950">{value}</p>
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
