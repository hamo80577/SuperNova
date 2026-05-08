"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Inbox,
  MoveRight,
  Search,
  ShieldAlert,
  Store,
  UserPlus,
  Users
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useCallback,
  useState,
  type ReactNode
} from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ChampBranch,
  type ChampBranchDetail,
  type UserSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import type { RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const tabs = ["Overview", "Pickers", "Requests", "Actions"] as const;
type BranchTab = (typeof tabs)[number];

export function ChampBranchesIndex() {
  const state = useAsyncData(workspacesApi.champBranches);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  if (state.status !== "ready") {
    return <WorkspaceState state={state} label="Loading assigned Branches" />;
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
      <BranchHero
        description="A Champ opens a Branch before starting future workflow actions. The system derives Chain and Vendor context from the selected Branch."
        eyebrow="Champ workspace"
        title="My Branches"
      />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Store} label="Assigned branches" value={state.data.totals.branches} />
        <MetricCard
          icon={Users}
          label="Active Pickers"
          value={state.data.totals.activePickers}
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label="Recent requests"
          value={state.data.totals.recentRequests}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Pending requests"
          value={state.data.totals.pendingRequests}
        />
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Assigned Branch list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by Branch, code, Chain, area, or city.
            </p>
          </div>
          <label className="relative min-w-64">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Branches"
              value={query}
            />
          </label>
        </div>

        {branches.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => (
              <BranchCard branch={branch} key={branch.assignment.id} />
            ))}
          </div>
        ) : (
          <EmptyState message="No assigned Branches match the current search." />
        )}
      </section>
    </div>
  );
}

export function ChampBranchWorkspace() {
  const params = useParams<{ vendorId: string }>();
  const loadBranch = useCallback(
    () => workspacesApi.champBranchDetail(params.vendorId),
    [params.vendorId]
  );
  const state = useAsyncData(loadBranch);
  const [activeTab, setActiveTab] = useState<BranchTab>("Overview");

  if (state.status !== "ready") {
    return <WorkspaceState state={state} label="Loading Branch workspace" />;
  }

  const branch = state.data;

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <Link
          className="mb-4 inline-flex items-center text-sm font-medium text-primary"
          href="/champ/branches"
          prefetch
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Branches
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">Selected Branch context</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {branch.vendor.vendorName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {branch.vendor.vendorCode} · {branch.chain.chainName} ·{" "}
              {formatLocation(branch.vendor.area, branch.vendor.city)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{branch.activePickerCount} active Pickers</Badge>
            <StatusBadge status={branch.assignment.status} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Definition label="Area Manager" value={branch.areaManager?.nameEn ?? "Not assigned"} />
          <Definition label="Branch code" value={branch.vendor.vendorCode} />
          <Definition label="Chain" value={branch.chain.chainName} />
          <Definition label="Champ since" value={formatDate(branch.assignment.startDate)} />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-4">
          {tabs.map((tab) => (
            <button
              aria-pressed={activeTab === tab}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
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

      {activeTab === "Overview" ? <BranchOverview branch={branch} /> : null}
      {activeTab === "Pickers" ? <BranchPickers pickers={branch.pickers.map((item) => item.picker)} /> : null}
      {activeTab === "Requests" ? <BranchRequests requests={branch.recentRequests} /> : null}
      {activeTab === "Actions" ? <BranchActions /> : null}
    </div>
  );
}

function BranchCard({ branch }: { branch: ChampBranch }) {
  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{branch.vendor.vendorName}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {branch.vendor.vendorCode} · {branch.chain.chainName}
          </p>
        </div>
        <StatusBadge status={branch.assignment.status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <Definition label="Location" value={formatLocation(branch.vendor.area, branch.vendor.city)} />
        <Definition label="Active Pickers" value={branch.activePickerCount} />
        <Definition label="Pending requests" value={branch.pendingRequestCount} />
      </div>
      <Link
        className={cn(buttonVariants({ size: "sm" }), "mt-4 w-full")}
        href={`/champ/branches/${branch.vendor.id}`}
        prefetch
      >
        Open Branch
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </article>
  );
}

function BranchOverview({ branch }: { branch: ChampBranchDetail }) {
  return (
    <section className="grid gap-4 lg:grid-cols-4">
      <MetricCard icon={Users} label="Active Pickers" value={branch.activePickerCount} />
      <MetricCard icon={BriefcaseBusiness} label="Recent requests" value={branch.recentRequestCount} />
      <MetricCard icon={ShieldAlert} label="Pending requests" value={branch.pendingRequestCount} />
      <MetricCard
        icon={Store}
        label="Area Manager"
        value={branch.areaManager?.nameEn ?? "Not assigned"}
      />
      <InfoCard title="Branch operating rule">
        <p className="text-sm leading-6 text-muted-foreground">
          This Branch is the source context for future Champ lifecycle actions.
          User-facing forms must derive `sourceVendorId` from this Branch and
          `sourceChainId` from its Chain.
        </p>
      </InfoCard>
      <InfoCard title="Current assignment">
        <Definition label="Assignment status" value={branch.assignment.status} />
        <Definition label="Start date" value={formatDate(branch.assignment.startDate)} />
        <Definition label="Branch" value={branch.vendor.vendorName} />
        <Definition label="Chain" value={branch.chain.chainName} />
      </InfoCard>
    </section>
  );
}

function BranchPickers({ pickers }: { pickers: UserSummary[] }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">Active Pickers in this Branch</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Read-only visibility from active Picker Branch assignments.
      </p>
      {pickers.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pickers.map((picker) => (
            <article className="rounded-md border bg-background p-4" key={picker.id}>
              <p className="text-sm font-medium">{picker.nameEn}</p>
              <p className="mt-1 text-xs text-muted-foreground">{picker.phoneNumber}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{picker.employmentStatus}</Badge>
                <Badge variant="muted">{picker.profileStatus}</Badge>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No active Pickers are assigned to this Branch." />
      )}
    </section>
  );
}

function BranchRequests({ requests }: { requests: RequestSummary[] }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">Recent Branch requests</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These are generic Phase 5 request records created by this Champ for the
        selected Branch. Final execution remains later-phase work.
      </p>
      {requests.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
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
                <tr className="border-b last:border-0" key={request.id}>
                  <td className="py-3 pr-4 font-medium">{formatEnum(request.type)}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="muted">{formatEnum(request.status)}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {request.currentStep ? formatEnum(request.currentStep) : "None"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      className={buttonVariants({ size: "sm", variant: "outline" })}
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

function BranchActions() {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline">Hiring</Badge>
            <h2 className="mt-3 text-lg font-semibold">New Hire</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Submit a new Picker request for this Branch. This action will run
              inside the selected Branch context.
            </p>
          </div>
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant="muted">Coming in Phase 6</Badge>
          <Button disabled type="button">
            Launch New Hire
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline">Movement</Badge>
            <h2 className="mt-3 text-lg font-semibold">Transfer Picker</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Move an existing Picker from this Branch through approval workflow.
              This action will run inside the selected Branch context.
            </p>
          </div>
          <MoveRight className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant="muted">Later phase</Badge>
          <Button disabled type="button" variant="outline">
            Plan Transfer
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge className="border-destructive/40 text-destructive" variant="outline">
              Offboarding
            </Badge>
            <h2 className="mt-3 text-lg font-semibold">Resignation and Termination</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              These are approval-based lifecycle actions, not direct edits. This
              action will run inside the selected Branch context.
            </p>
          </div>
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ActionStub
            label="Resignation"
            phase="Later phase"
            text="Record a Picker resignation request through approvals."
          />
          <ActionStub
            label="Termination"
            phase="Later phase"
            text="Record a termination request through approvals and final system application."
          />
        </div>
      </section>
    </div>
  );
}

function ActionStub({
  label,
  phase,
  text
}: {
  label: string;
  phase: string;
  text: string;
}) {
  return (
    <article className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
        </div>
        <Badge variant="muted">{phase}</Badge>
      </div>
      <Button className="mt-4" disabled type="button" variant="outline">
        Not available yet
      </Button>
    </article>
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

function BranchHero({
  description,
  eyebrow,
  title
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <Badge variant="outline">{eyebrow}</Badge>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Store;
  label: string;
  value: number | string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function WorkspaceState<T>({
  label,
  state
}: {
  label: string;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return (
      <div className="grid gap-3">
        <div className="h-28 animate-pulse rounded-lg border bg-muted/40" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {state.error}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-lg border bg-background p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatLocation(area?: string | null, city?: string | null) {
  return [area, city].filter(Boolean).join(", ") || "No location set";
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
