"use client";

import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DetailPanelSkeleton,
  StatsCardSkeleton
} from "@/components/ui/skeleton";
import {
  accessControlApi,
  type AccessControlOverview,
  type PermissionDefinition
} from "@/lib/api/access-control";
import type { UserRole } from "@/lib/auth/types";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const roleOrder: UserRole[] = [
  "PICKER",
  "CHAMP",
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];

const roleLabels: Record<UserRole, string> = {
  PICKER: "Picker",
  CHAMP: "Champ",
  AREA_MANAGER: "Area Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin"
};

const riskTone: Record<
  PermissionDefinition["riskLevel"],
  "default" | "muted" | "outline"
> = {
  LOW: "outline",
  MEDIUM: "muted",
  HIGH: "default",
  CRITICAL: "default"
};

export function AccessControlOverviewPage() {
  const state = useAccessControlOverview();

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">System owner</Badge>
            <h1 className="mt-3 text-xl font-semibold">Access Control</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Permission catalog and system role matrix for the current
              operational roles.
            </p>
          </div>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
      </section>

      <StateView state={state}>
        {(data) => <AccessControlOverviewContent data={data} />}
      </StateView>
    </div>
  );
}

function AccessControlOverviewContent({
  data
}: {
  data: AccessControlOverview;
}) {
  const groups = useMemo(
    () => Object.entries(data.permissionsByGroup),
    [data.permissionsByGroup]
  );

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Permissions" value={data.permissions.length} />
        <MetricCard label="Groups" value={groups.length} />
        <MetricCard label="System roles" value={roleOrder.length} />
        <MetricCard
          label="Super Admin permissions"
          value={data.systemRolePermissions.SUPER_ADMIN.length}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionHeader
          description="Grouped catalog entries exposed by the backend permission foundation."
          title="Permission Catalog"
        />
        {groups.map(([group, permissions]) => (
          <PermissionGroupCard
            group={group}
            key={group}
            permissions={permissions}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionHeader
          description="Current system roles mapped to catalog permission keys."
          title="System Role Matrix"
        />
        {roleOrder.map((role) => (
          <RolePermissionCard
            key={role}
            permissions={data.systemRolePermissions[role] ?? []}
            role={role}
          />
        ))}
      </section>
    </div>
  );
}

function useAccessControlOverview() {
  const [state, setState] = useState<AsyncState<AccessControlOverview>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await accessControlApi.overview();
        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        if (mounted) {
          setState({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Unable to load access control."
          });
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

function StateView<T>({
  children,
  state
}: {
  children: (data: T) => ReactNode;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading access control"
        className="grid gap-4 lg:grid-cols-4"
        role="status"
      >
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <DetailPanelSkeleton className="lg:col-span-2" />
        <DetailPanelSkeleton className="lg:col-span-2" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {state.error}
      </div>
    );
  }

  return <>{children(state.data)}</>;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <KeyRound className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}

function SectionHeader({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="xl:col-span-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function PermissionGroupCard({
  group,
  permissions
}: {
  group: string;
  permissions: PermissionDefinition[];
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{group}</h3>
        <Badge variant="outline">
          <span className="tabular-nums">{permissions.length}</span>
        </Badge>
      </div>
      <div className="mt-4 grid gap-3">
        {permissions.map((permission) => (
          <div className="rounded-md border bg-background p-3" key={permission.key}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{permission.label}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {permission.key}
                </p>
              </div>
              <Badge variant={riskTone[permission.riskLevel]}>
                {permission.riskLevel}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {permission.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RolePermissionCard({
  permissions,
  role
}: {
  permissions: string[];
  role: UserRole;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{roleLabels[role]}</h3>
        <Badge variant={role === "SUPER_ADMIN" ? "default" : "outline"}>
          <span className="tabular-nums">{permissions.length}</span>
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {permissions.map((permission) => (
          <Badge className="max-w-full" key={permission} variant="muted">
            <span className="break-all">{permission}</span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
