"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Inbox,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Store,
  UserPlus,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useState
} from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalUserProfileModal } from "@/components/users/operational-user-profile-modal";
import {
  type ChampBranch,
  type ChampBranchDetail,
  type ScopedPicker,
  workspacesApi
} from "@/lib/api/workspaces";
import type { RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { pushRoute, replaceRoute } from "@/lib/navigation";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

type BranchTab = "Pickers" | "Requests";

export function ChampBranchesIndex() {
  const router = useRouter();
  const state = useAsyncData(workspacesApi.champBranches);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    if (state.status === "ready" && state.data.branches.length === 1) {
      replaceRoute(router, `/champ/branches/${state.data.branches[0].vendor.id}`);
    }
  }, [router, state]);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} label="Loading assigned Branches" />;
  }

  if (state.data.branches.length === 1) {
    return <LoadingCard label="Opening your Branch" />;
  }

  const branches = state.data.branches.filter((branch) => {
    if (!deferredQuery) {
      return true;
    }

    return [
      branch.vendor.vendorName,
      branch.vendor.vendorCode,
      branch.chain.chainName,
      branch.vendor.area,
      branch.vendor.city
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(deferredQuery));
  });

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              Champ workspace
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              My Branches
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose a Branch workspace to manage Pickers and request actions.
            </p>
          </div>
          <label className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-xl pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Branches"
              value={query}
            />
          </label>
        </div>
      </section>

      {branches.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard branch={branch} key={branch.assignment.id} />
          ))}
        </section>
      ) : (
        <EmptyState message="No assigned Branches match the current search." />
      )}
    </div>
  );
}

export function ChampBranchWorkspace() {
  const params = useParams<{ vendorId: string }>();
  const router = useRouter();
  const loadBranch = useCallback(
    () => workspacesApi.champBranchDetail(params.vendorId),
    [params.vendorId]
  );
  const branchState = useAsyncData(loadBranch);
  const branchesState = useAsyncData(workspacesApi.champBranches);
  const [activeTab, setActiveTab] = useState<BranchTab>("Pickers");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedPicker, setSelectedPicker] = useState<ScopedPicker | null>(null);

  if (branchState.status !== "ready") {
    return <WorkspaceState state={branchState} label="Loading Branch workspace" />;
  }

  const branch = branchState.data;
  const allBranches =
    branchesState.status === "ready" ? branchesState.data.branches : [];

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-3 inline-flex items-center text-sm font-medium text-primary"
              href="/champ/branches"
              prefetch
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              My Branches
            </Link>
            <h1 className="truncate text-3xl font-semibold tracking-normal text-slate-950">
              {branch.vendor.vendorName}
            </h1>
            <p className="mt-1 text-base font-medium text-slate-500">
              {branch.chain.chainName}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {allBranches.length > 1 ? (
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Switch Branch
                <select
                  className="h-11 min-w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
                  onChange={(event) =>
                    pushRoute(router, `/champ/branches/${event.target.value}`)
                  }
                  value={branch.vendor.id}
                >
                  {allBranches.map((item) => (
                    <option key={item.vendor.id} value={item.vendor.id}>
                      {item.vendor.vendorName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="relative">
              <Button
                className="h-11 w-full rounded-xl sm:w-auto"
                onClick={() => setActionMenuOpen((current) => !current)}
                type="button"
              >
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {actionMenuOpen ? (
                <BranchActionMenu
                  branch={branch}
                  onClose={() => setActionMenuOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          {(["Pickers", "Requests"] as const).map((tab) => (
            <button
              aria-pressed={activeTab === tab}
              className={cn(
                "h-11 rounded-xl px-3 text-sm font-semibold transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-50"
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Pickers" ? (
        <BranchPickers
          pickers={branch.pickers}
          onOpenPicker={(picker) => setSelectedPicker(picker)}
        />
      ) : null}
      {activeTab === "Requests" ? (
        <BranchRequests requests={branch.recentRequests} />
      ) : null}

      {selectedPicker ? (
        <OperationalUserProfileModal
          actions={{
            onTransfer: (user) => {
              setSelectedPicker(null);
              pushRoute(
                router,
                `/champ/branches/${branch.vendor.id}/transfer?pickerId=${user.id}`
              );
            },
            onResignation: (user) => {
              setSelectedPicker(null);
              pushRoute(
                router,
                `/champ/branches/${branch.vendor.id}/resignation?pickerId=${user.id}`
              );
            },
            onTermination: (user) => {
              setSelectedPicker(null);
              pushRoute(
                router,
                `/champ/branches/${branch.vendor.id}/termination?pickerId=${user.id}`
              );
            }
          }}
          onClose={() => setSelectedPicker(null)}
          userId={selectedPicker.picker.id}
        />
      ) : null}
    </div>
  );
}

function BranchCard({ branch }: { branch: ChampBranch }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-950">
            {branch.vendor.vendorName}
          </p>
          <p className="mt-1 truncate text-sm text-slate-500">
            {branch.chain.chainName}
          </p>
        </div>
        <StatusBadge status={branch.assignment.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <MiniMetric icon={Users} label="Pickers" value={branch.activePickerCount} />
        <MiniMetric
          icon={ShieldAlert}
          label="Pending"
          value={branch.pendingRequestCount}
        />
      </div>
      <Link
        className={cn(buttonVariants({ size: "sm" }), "mt-4 h-10 w-full rounded-xl")}
        href={`/champ/branches/${branch.vendor.id}`}
        prefetch
      >
        Open Branch
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </article>
  );
}

function BranchActionMenu({
  branch,
  onClose
}: {
  branch: ChampBranchDetail;
  onClose: () => void;
}) {
  const actions = [
    {
      href: `/champ/branches/${branch.vendor.id}/new-hire`,
      icon: UserPlus,
      label: "New Hire",
      tone: "text-orange-700 bg-orange-50"
    },
    {
      href: `/champ/branches/${branch.vendor.id}/transfer`,
      icon: ArrowRight,
      label: "Transfer",
      tone: "text-blue-700 bg-blue-50"
    },
    {
      href: `/champ/branches/${branch.vendor.id}/resignation`,
      icon: ShieldAlert,
      label: "Resignation",
      tone: "text-amber-700 bg-amber-50"
    },
    {
      href: `/champ/branches/${branch.vendor.id}/termination`,
      icon: X,
      label: "Termination",
      tone: "text-red-700 bg-red-50"
    }
  ];

  return (
    <>
      <button
        aria-label="Close actions"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="absolute right-0 top-12 z-50 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold text-slate-950">Choose action</p>
          <p className="mt-0.5 text-xs text-slate-500">
            More tools can be added here later.
          </p>
        </div>
        <div className="grid gap-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={action.href}
                key={action.label}
                prefetch
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl",
                    action.tone
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function BranchPickers({
  onOpenPicker,
  pickers
}: {
  onOpenPicker: (picker: ScopedPicker) => void;
  pickers: ScopedPicker[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Pickers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active Picker assignments in this Branch.
          </p>
        </div>
        <Badge variant="muted">{pickers.length} active</Badge>
      </div>
      {pickers.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Picker</th>
                <th className="py-3 pr-4">Phone</th>
                <th className="py-3 pr-4">Employment</th>
                <th className="py-3 pr-4">Profile</th>
                <th className="py-3 pr-4">Account</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pickers.map((scopedPicker) => {
                const picker = scopedPicker.picker;
                return (
                  <tr
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-orange-50/40"
                    key={picker.id}
                    onClick={() => onOpenPicker(scopedPicker)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        onOpenPicker(scopedPicker);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-950">{picker.nameEn}</p>
                      {picker.nameAr ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {picker.nameAr}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {picker.phoneNumber}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{formatEnum(picker.employmentStatus)}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="muted">{formatEnum(picker.profileStatus)}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{formatEnum(picker.accountStatus)}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        className="h-9 rounded-xl"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPicker(scopedPicker);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No active Pickers are assigned to this Branch." />
      )}
    </section>
  );
}

function BranchRequests({ requests }: { requests: RequestSummary[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-slate-950">Recent requests</h2>
      <p className="mt-1 text-sm text-slate-500">
        Branch-scoped request records created by this Champ.
      </p>
      {requests.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Current Step</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr className="border-b border-slate-100 last:border-0" key={request.id}>
                  <td className="py-3 pr-4 font-medium text-slate-950">
                    {formatEnum(request.type)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="muted">{formatEnum(request.status)}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {request.currentStep ? formatEnum(request.currentStep) : "None"}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "rounded-xl"
                      )}
                      href={`/requests/${request.id}`}
                      prefetch
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No request history exists for this Branch yet." />
      )}
    </section>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Store;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function useAsyncData<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await loader();
        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (caughtError) {
        if (mounted) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Branch workspace."
          });
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [loader]);

  return state;
}

function WorkspaceState<T>({
  label,
  state
}: {
  label: string;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return <LoadingCard label={label} />;
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {state.error}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString();
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
