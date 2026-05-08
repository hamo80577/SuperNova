"use client";

import {
  AlertCircle,
  GitBranch,
  Inbox,
  Map,
  ShieldCheck,
  Store,
  UserRound,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type AssignmentStatus,
  type EntityStatus,
  type UserSummary,
  workspacesApi
} from "@/lib/api/workspaces";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function PickerWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.picker);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Picker workspace"
        description="Your profile and operational branch context are derived from active assignments."
        title={data.profile.nameEn}
      />
      <MetricCard icon={UserRound} label="Profile status" value={data.profile.profileStatus} />
      <MetricCard
        icon={Store}
        label="Assigned branch"
        value={data.branch?.vendorName ?? "No active branch"}
      />
      <MetricCard
        icon={GitBranch}
        label="Assigned chain"
        value={data.chain?.chainName ?? "No active chain"}
      />

      <InfoCard title="My Profile">
        <Definition label="Phone" value={data.profile.phoneNumber} />
        <Definition label="IBS ID" value={data.profile.ibsId ?? "Not set"} />
        <Definition label="Shopper ID" value={data.profile.shopperId ?? "Not set"} />
        <Definition label="Employment" value={data.profile.employmentStatus} />
        <Definition label="Account" value={data.profile.accountStatus} />
      </InfoCard>

      <InfoCard title="My Branch">
        {data.branch ? (
          <>
            <Definition label="Branch" value={data.branch.vendorName} />
            <Definition label="Code" value={data.branch.vendorCode} />
            <Definition label="Area" value={data.branch.area ?? "Not set"} />
            <Definition label="City" value={data.branch.city ?? "Not set"} />
            <Definition
              label="Assignment start"
              value={formatDate(data.currentAssignment?.startDate)}
            />
          </>
        ) : (
          <EmptyInline message="No active branch assignment is available." />
        )}
      </InfoCard>

      <InfoCard title="My Managers">
        <Definition label="Champ" value={data.champ?.nameEn ?? "Not assigned"} />
        <Definition
          label="Area Manager"
          value={data.areaManager?.nameEn ?? "Not assigned"}
        />
        <Definition label="Chain" value={data.chain?.chainName ?? "Not assigned"} />
      </InfoCard>

      <InfoCard title="Profile Completion">
        <Definition label="Status" value={data.profileCompletion.status} />
        {data.profileCompletion.missingFields.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.profileCompletion.missingFields.map((field) => (
              <Badge key={field} variant="outline">
                {field}
              </Badge>
            ))}
          </div>
        ) : (
          <EmptyInline message="No missing profile fields detected." />
        )}
      </InfoCard>
    </WorkspaceGrid>
  );
}

export function ChampWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.champ);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Champ workspace"
        description="Assigned branches and Pickers are derived from Vendor Champ and Picker Branch assignments."
        title={data.champ.nameEn}
      />
      <MetricCard icon={Store} label="My branches" value={data.totals.branches} />
      <MetricCard icon={Users} label="Active Pickers" value={data.totals.activePickers} />
      <PlaceholderCard title="Requests placeholder" value={data.placeholders.requests} />

      <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-4">
        <SectionHeader
          description="Branches currently assigned to this Champ."
          title="My Branches"
        />
        {data.branches.length ? (
          <div className="mt-4 grid gap-3">
            {data.branches.map((branch) => (
              <div className="rounded-md border bg-background p-4" key={branch.assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{branch.vendor.vendorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.vendor.vendorCode} · {branch.chain.chainName}
                    </p>
                  </div>
                  <Badge variant="outline">{branch.activePickerCount} Pickers</Badge>
                </div>
                <PickerList pickers={branch.pickers.map((item) => item.picker)} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="No active branch assignments are available." />
        )}
      </section>

      <PlaceholderCard title="Actions placeholder" value={data.placeholders.actions} />
    </WorkspaceGrid>
  );
}

export function AreaManagerWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.areaManager);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Area Manager workspace"
        description="Chain, branch, Champ, and Picker visibility is derived from active Chain Area Manager assignments."
        title={data.areaManager.nameEn}
      />
      <MetricCard icon={GitBranch} label="Chains under me" value={data.totals.chains} />
      <MetricCard icon={Store} label="Branches" value={data.totals.vendors} />
      <MetricCard icon={Users} label="Users under me" value={data.usersUnderMe.length} />

      <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-4">
        <SectionHeader
          description="Drill down from Chain to Vendor to assigned users."
          title="Operations Map"
        />
        {data.chains.length ? (
          <div className="mt-4 grid gap-4">
            {data.chains.map((chain) => (
              <div className="rounded-md border bg-background p-4" key={chain.assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{chain.chain.chainName}</p>
                    <p className="text-sm text-muted-foreground">
                      {chain.chain.chainCode} · {chain.vendorCount} branches
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{chain.activeChampCount} Champs</Badge>
                    <Badge variant="outline">{chain.activePickerCount} Pickers</Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {chain.vendors.map((vendor) => (
                    <div className="rounded-md border bg-card p-3" key={vendor.vendor.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {vendor.vendor.vendorName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {vendor.vendor.vendorCode} · {vendor.vendor.area ?? "No area"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="muted">{vendor.activeChampCount} Champs</Badge>
                          <Badge variant="muted">{vendor.activePickerCount} Pickers</Badge>
                        </div>
                      </div>
                      <UserChips
                        users={[
                          ...vendor.champs.map((item) => item.champ),
                          ...vendor.pickers.map((item) => item.picker)
                        ]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="No active Chain Area Manager assignments are available." />
        )}
      </section>

      <PlaceholderCard title="Requests placeholder" value={data.placeholders.requests} />
      <PlaceholderCard title="Approvals placeholder" value={data.placeholders.approvals} />
    </WorkspaceGrid>
  );
}

export function AdminWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.admin);

  if (state.status !== "ready") {
    return <WorkspaceState state={state} />;
  }

  const data = state.data;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Admin workspace"
        description="System-wide operational visibility with links to the controlled management pages."
        title="Admin Control Center"
      />
      <MetricCard icon={GitBranch} label="Chains" value={data.totals.chains} />
      <MetricCard icon={Store} label="Vendors" value={data.totals.vendors} />
      <MetricCard icon={Users} label="Users" value={data.totals.users} />
      <MetricCard
        icon={Map}
        label="Active Picker assignments"
        value={data.totals.activePickerAssignments}
      />

      <InfoCard title="Organization">
        <Definition label="Active chains" value={data.totals.activeChains} />
        <Definition label="Active vendors" value={data.totals.activeVendors} />
        <Definition
          label="Active Champ assignments"
          value={data.totals.activeChampAssignments}
        />
        <Definition
          label="Active Area Manager assignments"
          value={data.totals.activeAreaManagerAssignments}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/chains"
            prefetch
          >
            Manage Chains
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/vendors"
            prefetch
          >
            Manage Vendors
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/admin/assignments"
            prefetch
          >
            Manage Assignments
          </Link>
        </div>
      </InfoCard>

      <InfoCard title="Recent Chains">
        <SimpleList
          emptyLabel="No chains available."
          items={data.recent.chains.map((chain) => ({
            id: chain.id,
            label: chain.chainName,
            meta: chain.chainCode,
            status: chain.status
          }))}
        />
      </InfoCard>

      <InfoCard title="Recent Vendors">
        <SimpleList
          emptyLabel="No vendors available."
          items={data.recent.vendors.map((vendor) => ({
            id: vendor.id,
            label: vendor.vendorName,
            meta: vendor.vendorCode,
            status: vendor.status
          }))}
        />
      </InfoCard>

      <InfoCard title="Pending Admin Actions">
        <EmptyInline message={data.placeholders.pendingAdminActions} />
      </InfoCard>
    </WorkspaceGrid>
  );
}

function useWorkspaceData<T>(loader: () => Promise<T>) {
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
                : "Unable to load workspace."
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

function WorkspaceState<T>({ state }: { state: AsyncState<T> }) {
  if (state.status === "loading") {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        Loading workspace
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {state.error}
    </div>
  );
}

function WorkspaceGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-4">{children}</div>;
}

function HeroCard({
  badge,
  description,
  title
}: {
  badge: string;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">{badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="muted">Phase 4 scoped view</Badge>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
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
      <SectionHeader title={title} />
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function PlaceholderCard({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-lg border border-dashed bg-card p-5 shadow-sm">
      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </section>
  );
}

function SectionHeader({
  description,
  title
}: {
  description?: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function PickerList({ pickers }: { pickers: UserSummary[] }) {
  if (!pickers.length) {
    return <EmptyInline message="No active Pickers are assigned to this branch." />;
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {pickers.map((picker) => (
        <div className="rounded-md border bg-card p-3" key={picker.id}>
          <p className="text-sm font-medium">{picker.nameEn}</p>
          <p className="text-xs text-muted-foreground">{picker.phoneNumber}</p>
        </div>
      ))}
    </div>
  );
}

function UserChips({ users }: { users: UserSummary[] }) {
  if (!users.length) {
    return <EmptyInline message="No active assigned users in this branch." />;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {users.map((user) => (
        <Badge key={user.id} variant="outline">
          {user.nameEn} · {user.role}
        </Badge>
      ))}
    </div>
  );
}

function SimpleList({
  emptyLabel,
  items
}: {
  emptyLabel: string;
  items: Array<{
    id: string;
    label: string;
    meta: string;
    status: AssignmentStatus | EntityStatus;
  }>;
}) {
  if (!items.length) {
    return <EmptyInline message={emptyLabel} />;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
          key={item.id}
        >
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.meta}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="mt-4 grid place-items-center rounded-md border bg-background p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{message}</p>;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString();
}
