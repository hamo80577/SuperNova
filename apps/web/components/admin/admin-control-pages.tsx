"use client";

import {
  AlertCircle,
  Archive,
  ClipboardCheck,
  FileSearch,
  Inbox,
  Settings,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type AccountStatus,
  type AdminArchivedUser,
  type AdminAuditLog,
  type AdminPendingAction,
  type BlockStatus,
  type EmploymentStatus
} from "@/lib/api/admin";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const employmentStatuses: Array<EmploymentStatus | ""> = [
  "",
  "NEW_HIRE_PENDING",
  "ACTIVE",
  "RESIGNED",
  "TERMINATED",
  "ARCHIVED"
];
const accountStatuses: Array<AccountStatus | ""> = [
  "",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED"
];
const blockStatuses: Array<BlockStatus | ""> = [
  "",
  "NO_BLOCK",
  "TEMPORARY_BLOCK",
  "PERMANENT_BLOCK"
];

export function AdminPendingActionsPage() {
  const [state, setState] = useState<AsyncState<AdminPendingAction[]>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await adminApi.listPendingActions({ pageSize: 50 });
        if (mounted) {
          setState({ status: "ready", data: response.items });
        }
      } catch (error) {
        if (mounted) {
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to load pending actions."
          });
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PageShell
      badge="Admin final actions"
      description="Requests waiting for Admin-controlled finalization. Use request detail pages for Shopper ID or offboarding confirmation."
      icon={ClipboardCheck}
      title="Pending Final Actions"
    >
      <StateView state={state}>
        {(items) =>
          items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Request</th>
                    <th className="py-3 pr-4">Required action</th>
                    <th className="py-3 pr-4">Source</th>
                    <th className="py-3 pr-4">Target</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="border-b last:border-0" key={item.id}>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{formatEnum(item.type)}</Badge>
                          <GenericStatusBadge status={item.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatEnum(item.currentStep ?? "NO_CURRENT_STEP")}
                        </p>
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {item.requiredActionLabel}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {item.sourceVendor?.vendorName ??
                          item.sourceChain?.chainName ??
                          "No source"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {item.targetUser?.nameEn ?? "No target user"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline"
                          })}
                          href={item.route}
                          prefetch
                        >
                          Open request
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No Admin final actions are pending." />
          )
        }
      </StateView>
    </PageShell>
  );
}

export function AdminArchivedUsersPage() {
  const [state, setState] = useState<AsyncState<AdminArchivedUser[]>>({
    status: "loading"
  });
  const [filters, setFilters] = useState({
    q: "",
    accountStatus: "" as AccountStatus | "",
    employmentStatus: "" as EmploymentStatus | "",
    blockStatus: "" as BlockStatus | ""
  });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await adminApi.listArchivedUsers({
        ...filters,
        pageSize: 50
      });
      setState({ status: "ready", data: response.items });
    } catch (error) {
      setState({
        status: "error",
        error:
          error instanceof Error ? error.message : "Unable to load archived users."
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell
      badge="Archived identities"
      description="Safe Admin visibility into archived or deactivated users, block state, latest offboarding request, and closed assignment history."
      icon={Archive}
      title="Archived Users"
    >
      <FilterGrid>
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, q: event.target.value }))
          }
          placeholder="Search name, phone, Shopper ID, block reason"
          value={filters.q}
        />
        <SelectFilter
          label="Account"
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              accountStatus: value as AccountStatus | ""
            }))
          }
          options={accountStatuses}
          value={filters.accountStatus}
        />
        <SelectFilter
          label="Employment"
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              employmentStatus: value as EmploymentStatus | ""
            }))
          }
          options={employmentStatuses}
          value={filters.employmentStatus}
        />
        <SelectFilter
          label="Block"
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              blockStatus: value as BlockStatus | ""
            }))
          }
          options={blockStatuses}
          value={filters.blockStatus}
        />
        <Button onClick={() => void load()} type="button" variant="outline">
          Apply
        </Button>
      </FilterGrid>

      <StateView state={state}>
        {(items) =>
          items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">User</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Block</th>
                    <th className="py-3 pr-4">Latest offboarding</th>
                    <th className="py-3 pr-4">Closed assignments</th>
                    <th className="py-3 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr className="border-b align-top last:border-0" key={user.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{user.nameEn}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.phoneNumber} · {user.shopperId ?? "No Shopper ID"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="grid gap-2">
                          <GenericStatusBadge status={user.accountStatus} />
                          <GenericStatusBadge status={user.employmentStatus} />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="grid gap-1">
                          <GenericStatusBadge status={user.blockStatus} />
                          <p className="text-xs text-muted-foreground">
                            {user.blockedUntil
                              ? `Until ${formatDate(user.blockedUntil)}`
                              : "No block expiry"}
                          </p>
                          <p className="max-w-xs text-xs text-muted-foreground">
                            {user.blockReason ?? "No block reason"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {user.latestOffboardingRequest ? (
                          <Link
                            className="text-sm font-medium text-primary hover:underline"
                            href={`/tickets?requestId=${user.latestOffboardingRequest.id}`}
                            prefetch
                          >
                            {formatEnum(user.latestOffboardingRequest.type)} ·{" "}
                            {formatEnum(user.latestOffboardingRequest.status)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {user.closedAssignments.length
                          ? user.closedAssignments
                              .map(
                                (assignment) =>
                                  `${assignment.vendor.vendorName} (${formatDate(
                                    assignment.endDate
                                  )})`
                              )
                              .join(", ")
                          : "No closed assignments"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDateTime(user.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No archived or deactivated users match the filters." />
          )
        }
      </StateView>
    </PageShell>
  );
}

export function AdminAuditLogsPage() {
  const [state, setState] = useState<AsyncState<AdminAuditLog[]>>({
    status: "loading"
  });
  const [filters, setFilters] = useState({
    q: "",
    action: "",
    entityType: "",
    from: "",
    to: ""
  });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await adminApi.listAuditLogs({
        ...filters,
        pageSize: 50
      });
      setState({ status: "ready", data: response.items });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load audit logs."
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell
      badge="Sensitive action history"
      description="Paginated Admin visibility into workflow, approval, assignment, and account audit events. Secret-like fields are redacted by the API."
      icon={FileSearch}
      title="Audit Logs"
    >
      <FilterGrid>
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, q: event.target.value }))
          }
          placeholder="Search action, entity, actor"
          value={filters.q}
        />
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, action: event.target.value }))
          }
          placeholder="Action"
          value={filters.action}
        />
        <Input
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              entityType: event.target.value
            }))
          }
          placeholder="Entity type"
          value={filters.entityType}
        />
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, from: event.target.value }))
          }
          type="date"
          value={filters.from}
        />
        <Input
          onChange={(event) =>
            setFilters((current) => ({ ...current, to: event.target.value }))
          }
          type="date"
          value={filters.to}
        />
        <Button onClick={() => void load()} type="button" variant="outline">
          Apply
        </Button>
      </FilterGrid>

      <StateView state={state}>
        {(items) =>
          items.length ? (
            <div className="grid gap-3">
              {items.map((log) => (
                <article
                  className="rounded-lg border bg-background p-4"
                  key={log.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{log.action}</Badge>
                        <Badge variant="muted">{log.entityType}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Actor: {log.actor?.nameEn ?? "System"} · Entity:{" "}
                        {log.entityId}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <details className="mt-3 rounded-md border bg-card p-3 text-xs">
                    <summary className="cursor-pointer font-medium">
                      View old/new JSON
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <JsonBlock label="Old value" value={log.oldValue} />
                      <JsonBlock label="New value" value={log.newValue} />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No audit logs match the current filters." />
          )
        }
      </StateView>
    </PageShell>
  );
}

export function AdminSettingsPlaceholderPage() {
  const settings = [
    {
      title: "Approval policy",
      body: "Future controls for workflow approval rules. Phase 10 does not enable production policy changes."
    },
    {
      title: "Notification policy",
      body: "Future controls for notification channels and templates. Current notifications remain workflow-generated."
    },
    {
      title: "Security policy",
      body: "Future controls for password, session, and access policies. Auth behavior is unchanged in Phase 10."
    },
    {
      title: "Data retention",
      body: "Future controls for archival retention. Audit and workflow history are preserved."
    }
  ];

  return (
    <PageShell
      badge="Read-only placeholder"
      description="Settings are placeholders in Phase 10. No production setting changes are enabled yet."
      icon={Settings}
      title="System Settings"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((item) => (
          <section className="rounded-lg border bg-background p-5" key={item.title}>
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>
            <Badge className="mt-4" variant="muted">
              Placeholder only
            </Badge>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

function PageShell({
  badge,
  children,
  description,
  icon: Icon,
  title
}: {
  badge: string;
  children: ReactNode;
  description: string;
  icon: typeof ClipboardCheck;
  title: string;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">{badge}</Badge>
            <h1 className="mt-3 text-xl font-semibold">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </section>
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        {children}
      </section>
    </div>
  );
}

function StateView<T>({
  children,
  state
}: {
  children: (data: T) => ReactNode;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return <LoadingState />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.error} />;
  }

  return <>{children(state.data)}</>;
}

function FilterGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-[1fr_180px_180px_180px_auto]">
      {children}
    </div>
  );
}

function SelectFilter({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-11 rounded-md border border-input bg-background px-3 text-sm"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option || "all"} value={option}>
          {option ? formatEnum(option) : `All ${label}`}
        </option>
      ))}
    </select>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 font-medium">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function GenericStatusBadge({ status }: { status: string }) {
  const positive = ["ACTIVE", "COMPLETE", "APPROVED", "COMPLETED", "NO_BLOCK"];
  const caution = ["PENDING_ADMIN", "TEMPORARY_BLOCK", "SUSPENDED"];
  const destructive = [
    "REJECTED",
    "CANCELLED",
    "ARCHIVED",
    "TERMINATED",
    "PERMANENT_BLOCK"
  ];

  const className = destructive.includes(status)
    ? "border-destructive/40 text-destructive"
    : caution.includes(status)
      ? "border-amber-400/60 text-amber-700"
      : undefined;

  return (
    <Badge
      className={className}
      variant={positive.includes(status) ? "default" : "outline"}
    >
      {formatEnum(status)}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border bg-background p-5 text-sm text-muted-foreground">
      Loading Admin controls
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-lg border bg-background p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
