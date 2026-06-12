"use client";

import {
  AlertCircle,
  ArrowRight,
  Archive,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  Inbox,
  Loader2,
  Map,
  MoveRight,
  Settings,
  ShieldCheck,
  Store,
  X,
  UserRound,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton
} from "@/components/ui/skeleton";
import { organizationApi, type Vendor } from "@/lib/api/organization";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import {
  type AssignmentStatus,
  type EntityStatus,
  type UserSummary,
  type VendorSummary,
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
  const singleBranch = data.branches.length === 1 ? data.branches[0] : null;

  return (
    <WorkspaceGrid>
      <HeroCard
        badge="Champ workspace"
        description={`Welcome ${data.champ.nameEn}. Champ operations are Branch-first: open a Branch before starting any future lifecycle action.`}
        title="Branch Operations"
      />
      <MetricCard icon={Store} label="Assigned branches" value={data.totals.branches} />
      <MetricCard icon={Users} label="Active Pickers" value={data.totals.activePickers} />
      <MetricCard
        icon={ShieldCheck}
        label="Pending requests"
        value={data.totals.pendingRequests}
      />
      <MetricCard
        icon={Inbox}
        label="Recent branch requests"
        value={data.totals.recentRequests}
      />

      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-4">
        <SectionHeader
          description={
            singleBranch
              ? "You have one active Branch. Use it as your primary operations workspace."
              : "Use the global dashboard for totals only. Open one Branch before taking future workflow actions."
          }
          title={singleBranch ? "Primary Branch Workspace" : "Assigned Branches"}
        />
        {data.branches.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.branches.map((branch) => (
              <div
                className={
                  singleBranch
                    ? "rounded-lg border border-primary/30 bg-primary/5 p-5 md:col-span-2 xl:col-span-3"
                    : "rounded-md border bg-background p-4"
                }
                key={branch.assignment.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{branch.vendor.vendorName}</p>
                    <p className="text-sm text-muted-foreground">
                      {branch.vendor.vendorCode} · {branch.chain.chainName} ·{" "}
                      {[branch.vendor.area, branch.vendor.city]
                        .filter(Boolean)
                        .join(", ") || "No area set"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{branch.activePickerCount} Pickers</Badge>
                    <Badge variant="muted">
                      {branch.pendingRequestCount} pending
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Future New Hire, Transfer, and Resignation actions
                  will run inside this selected Branch context.
                </p>
                <div className="mt-4">
                  <Link
                    className={buttonVariants({ size: "sm" })}
                    href={`/champ/branches/${branch.vendor.id}`}
                    prefetch
                  >
                    {singleBranch ? "Open Branch Workspace" : "Open Branch"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="No active branch assignments are available." />
        )}
      </section>

      <PlaceholderCard title="Branch-first requests" value={data.placeholders.requests} />
      <PlaceholderCard title="Lifecycle actions" value={data.placeholders.actions} />
    </WorkspaceGrid>
  );
}

export function AreaManagerWorkspaceDashboard() {
  const state = useWorkspaceData(workspacesApi.areaManager);
  const [transferAction, setTransferAction] = useState<{
    picker: UserSummary;
    sourceVendor: VendorSummary;
  } | null>(null);

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

      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-4">
        <SectionHeader
          description="Drill down from Chain to Vendor to assigned users."
          title="Operations Map"
        />
        {data.chains.length ? (
          <div className="mt-4 grid gap-4">
            {data.chains.map((chain) => (
              <div className="rounded-[12px] border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4" key={chain.assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--sn-ink)]">{chain.chain.chainName}</p>
                    <p className="text-sm text-[color:var(--sn-muted)]">
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
                    <div className="rounded-[10px] border border-[color:var(--sn-border)] bg-white p-3" key={vendor.vendor.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[color:var(--sn-ink)]">
                            {vendor.vendor.vendorName}
                          </p>
                          <p className="text-xs text-[color:var(--sn-muted)]">
                            {vendor.vendor.vendorCode} · {vendor.vendor.area ?? "No area"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="muted">{vendor.activeChampCount} Champs</Badge>
                          <Badge variant="muted">{vendor.activePickerCount} Pickers</Badge>
                        </div>
                      </div>
                      <UserChips
                        onTransferPicker={(picker) =>
                          setTransferAction({
                            picker,
                            sourceVendor: vendor.vendor
                          })
                        }
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
      {transferAction ? (
        <AreaManagerTransferModal
          action={transferAction}
          onClose={() => setTransferAction(null)}
        />
      ) : null}
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
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-[16px] border border-[color:var(--sn-border)] bg-white shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD8BD] bg-[#FFE8D9] px-3 py-1 text-xs font-semibold text-[color:var(--tlb-orange-900)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-3xl">
              Admin Control Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--sn-body)]">
              System-wide operational visibility for organization setup, final
              actions, archive review, audit history, and role-scoped reporting.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                className={buttonVariants({
                  className: "rounded-xl bg-primary px-4",
                  size: "sm"
                })}
                href="/tickets"
                prefetch
              >
                Pending final actions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                className={buttonVariants({
                  className: "rounded-xl border-[color:var(--sn-border)] bg-white",
                  size: "sm",
                  variant: "outline"
                })}
                href="/admin/reports"
                prefetch
              >
                Open reports
              </Link>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-4">
            <Definition label="Active chains" value={data.totals.activeChains} />
            <Definition label="Active vendors" value={data.totals.activeVendors} />
            <Definition
              label="Active Picker assignments"
              value={data.totals.activePickerAssignments}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={GitBranch} label="Chains" value={data.totals.chains} />
        <MetricCard icon={Store} label="Vendors" value={data.totals.vendors} />
        <MetricCard icon={Users} label="Users" value={data.totals.users} />
        <MetricCard
          icon={Map}
          label="Active Picker assignments"
          value={data.totals.activePickerAssignments}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <InfoCard title="Organization Setup">
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
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <AdminControlLink
              description="Chains, Branches, and assignments."
              href="/admin/organization"
              icon={GitBranch}
              label="Organization"
            />
            <AdminControlLink
              description="Partner Branch records."
              href="/admin/organization"
              icon={Store}
              label="Vendors"
            />
            <AdminControlLink
              description="Role assignment links."
              href="/admin/organization"
              icon={Map}
              label="Assignments"
            />
          </div>
        </InfoCard>

        <InfoCard title="Pending Final Actions">
          <AdminControlLink
            description="Review New Hire Shopper ID and Resignation finalization work."
            href="/tickets"
            icon={ClipboardCheck}
            label="Open pending final actions"
          />
          <AdminControlLink
            description="Review approval queues without bypassing workflow state."
            href="/tickets"
            icon={ShieldCheck}
            label="Open approvals"
          />
          <AdminControlLink
            description="Inspect request records and their current workflow status."
            href="/tickets"
            icon={Inbox}
            label="Open requests"
          />
        </InfoCard>

        <InfoCard title="Archive & Audit">
          <AdminControlLink
            description="Inspect archived/deactivated users and block status."
            href="/admin/archived-users"
            icon={Archive}
            label="View archived users"
          />
          <AdminControlLink
            description="Review workflow, approval, assignment, and account audit events."
            href="/admin/audit-logs"
            icon={FileSearch}
            label="View audit logs"
          />
          <AdminControlLink
            description="Choose the workspace appearance theme for your account."
            href="/settings"
            icon={Settings}
            label="Open settings"
          />
        </InfoCard>

        <InfoCard title="Reports">
          <AdminControlLink
            description="Open system-wide operational counts and scoped report surfaces."
            href="/admin/reports"
            icon={ClipboardCheck}
            label="Open admin reports"
          />
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
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
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
      </div>
    </div>
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
      <div
        aria-busy="true"
        aria-label="Loading workspace"
        className="grid gap-4"
        role="status"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <DetailPanelSkeleton />
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
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="outline">{badge}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--sn-ink)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sn-muted)]">
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
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3EB] text-[color:var(--tlb-orange)]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-[family-name:var(--font-data)] font-semibold tracking-normal text-[color:var(--sn-ink)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{label}</p>
    </section>
  );
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] lg:col-span-2">
      <SectionHeader title={title} />
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function PlaceholderCard({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-[16px] border border-dashed border-[color:var(--sn-border)] bg-white p-5">
      <ShieldCheck className="h-5 w-5 text-[color:var(--sn-muted)]" />
      <p className="mt-4 text-sm font-medium text-[color:var(--sn-ink)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--sn-muted)]">{value}</p>
    </section>
  );
}

function AdminControlLink({
  description,
  href,
  icon: Icon,
  label
}: {
  description: string;
  href: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      className="group flex items-start gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 transition-colors hover:border-[#FFD8BD] hover:bg-[#FFE8D9]"
      href={href}
      prefetch
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="block text-sm font-semibold text-[color:var(--sn-ink)]">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[color:var(--sn-muted)]">
          {description}
        </span>
      </span>
    </Link>
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
      <h2 className="text-base font-semibold text-[color:var(--sn-ink)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-[color:var(--sn-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-[color:var(--sn-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[color:var(--sn-ink)]">{value}</span>
    </div>
  );
}

function UserChips({
  onTransferPicker,
  users
}: {
  onTransferPicker?: (user: UserSummary) => void;
  users: UserSummary[];
}) {
  if (!users.length) {
    return <EmptyInline message="No active assigned users in this branch." />;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--sn-border)] bg-white px-2.5 py-1 text-xs font-medium text-[color:var(--sn-body)]"
          key={user.id}
        >
          {user.nameEn} · {user.role}
          {user.role === "PICKER" && onTransferPicker ? (
            <button
              className="ml-1 rounded-full border border-[#FFD8BD] px-2 py-0.5 text-[color:var(--tlb-orange-900)] hover:bg-[#FFE8D9]"
              onClick={() => onTransferPicker(user)}
              type="button"
            >
              Transfer
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function AreaManagerTransferModal({
  action,
  onClose
}: {
  action: { picker: UserSummary; sourceVendor: VendorSummary };
  onClose: () => void;
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function loadVendors() {
      setIsLoading(true);
      try {
        const firstPage = await organizationApi.listVendors({
          page: 1,
          pageSize: 100,
          status: "ACTIVE"
        });
        const remainingPages = await Promise.all(
          Array.from(
            { length: Math.max(0, firstPage.meta.totalPages - 1) },
            (_, index) =>
              organizationApi.listVendors({
                page: index + 2,
                pageSize: 100,
                status: "ACTIVE"
              })
          )
        );
        if (mounted) {
          setVendors([
            ...firstPage.items,
            ...remainingPages.flatMap((page) => page.items)
          ]);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load destination Branches."
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadVendors();
    return () => {
      mounted = false;
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const request = await requestsApi.createTransfer({
          sourceVendorId: action.sourceVendor.id,
          targetUserId: action.picker.id,
          destinationVendorId,
          reason
        });
        setCreatedRequest(request);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create Transfer request."
        );
      }
    });
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[140] grid place-items-end bg-[rgba(65,21,23,0.35)] p-0 sm:place-items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[28px] border border-[color:var(--sn-border)] bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Badge variant="outline">Area Manager Transfer</Badge>
            <h2 className="mt-2 text-lg font-semibold text-[color:var(--sn-ink)]">
              Transfer Picker
            </h2>
          </div>
          <Button
            aria-label="Close transfer modal"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {createdRequest ? (
          <div className="rounded-2xl border border-[oklch(0.85_0.08_150)] bg-[oklch(0.95_0.045_150)] p-4 text-sm text-[oklch(0.58_0.13_150)]">
            <p className="font-semibold">Transfer request created.</p>
            <p className="mt-1">
              Status: {formatEnum(createdRequest.status)}. Current step:{" "}
              {createdRequest.currentStep
                ? formatEnum(createdRequest.currentStep)
                : "Completed"}.
            </p>
            <Link
              className={buttonVariants({
                className: "mt-3 rounded-xl bg-white border-[color:var(--sn-border)]",
                size: "sm",
                variant: "outline"
              })}
              href={`/tickets?requestId=${createdRequest.id}`}
              prefetch
            >
              Open request detail
            </Link>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={onSubmit}>
            {error ? <ModalError message={error} /> : null}
            <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 text-sm">
              <p className="font-semibold text-[color:var(--sn-ink)]">{action.picker.nameEn}</p>
              <p className="text-[color:var(--sn-muted)]">
                {action.picker.phoneNumber} · From {action.sourceVendor.vendorName}
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Destination Branch
              <Select
                aria-label="Destination Branch"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                disabled={isLoading}
                onChange={(event) => setDestinationVendorId(event.target.value)}
                required
                value={destinationVendorId}
              >
                <option value="">
                  {isLoading ? "Loading Branches..." : "Select destination Branch"}
                </option>
                {vendors
                  .filter((vendor) => vendor.id !== action.sourceVendor.id)
                  .map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName} · {vendor.chain.chainName}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Reason
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: operational branch move"
                required
                value={reason}
              />
            </label>
            <div className="rounded-2xl border border-[#FFD8BD] bg-[#FFE8D9] p-3 text-sm text-[color:var(--tlb-orange-900)]">
              <MoveRight className="mb-2 h-4 w-4" />
              Same-chain transfers complete immediately for your Chain. Cross-chain
              transfers wait for destination Area Manager approval.
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isPending || isLoading} type="submit">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Transfer
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

function ModalError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[oklch(0.85_0.08_27)] bg-[oklch(0.95_0.035_27)] p-3 text-sm text-[oklch(0.55_0.19_27)]">
      {message}
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
          className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3"
          key={item.id}
        >
          <div>
            <p className="text-sm font-semibold text-[color:var(--sn-ink)]">{item.label}</p>
            <p className="text-xs text-[color:var(--sn-muted)]">{item.meta}</p>
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
