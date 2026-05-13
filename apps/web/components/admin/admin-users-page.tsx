"use client";

import {
  Archive,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalUserProfileModal } from "@/components/users/operational-user-profile-modal";
import { usersApi } from "@/lib/api/users";
import type {
  AccountStatus,
  BlockStatus,
  EmploymentStatus,
  ProfileStatus,
  SafeUser,
  UserRole
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const roles: UserRole[] = [
  "PICKER",
  "CHAMP",
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];
const accountStatuses: AccountStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED"
];
const employmentStatuses: EmploymentStatus[] = [
  "NEW_HIRE_PENDING",
  "ACTIVE",
  "RESIGNED",
  "TERMINATED",
  "ARCHIVED"
];
const profileStatuses: ProfileStatus[] = [
  "INCOMPLETE",
  "PENDING_REVIEW",
  "COMPLETE"
];
const blockStatuses: BlockStatus[] = [
  "NO_BLOCK",
  "TEMPORARY_BLOCK",
  "PERMANENT_BLOCK"
];

export function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<AsyncState<SafeUser[]>>({
    status: "loading"
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    q: "",
    role: "" as UserRole | "",
    accountStatus: "" as AccountStatus | "",
    employmentStatus: "" as EmploymentStatus | "",
    profileStatus: "" as ProfileStatus | "",
    blockStatus: "" as BlockStatus | ""
  });

  async function loadUsers() {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await fetchAllUsers() });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load users."
      });
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [searchParams]);

  const users = state.status === "ready" ? state.data : [];
  const filteredUsers = useMemo(
    () => filterUsers(users, filters),
    [filters, users]
  );
  const stats = useMemo(() => buildStats(users), [users]);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <Badge
              className="border-orange-200 bg-orange-50 text-orange-700"
              variant="outline"
            >
              Admin users
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              Users Control Center
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Search, filter, export, and open operational profiles for every
              SuperNova user.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11 rounded-xl"
              onClick={() => void loadUsers()}
              type="button"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="h-11 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
              disabled={!users.length}
              onClick={() => exportUsersCsv(users)}
              type="button"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={stats.total} />
        <StatCard icon={UserCheck} label="Active accounts" value={stats.active} />
        <StatCard icon={ShieldCheck} label="Complete profiles" value={stats.complete} />
        <StatCard icon={Archive} label="Archived users" value={stats.archived} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Filter className="h-4 w-4 text-orange-600" />
          Filters
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(140px,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-xl pl-9"
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Search name, phone, ID"
              value={filters.q}
            />
          </label>
          <SelectFilter
            label="Role"
            onChange={(role) =>
              setFilters((current) => ({ ...current, role: role as UserRole | "" }))
            }
            options={roles}
            value={filters.role}
          />
          <SelectFilter
            label="Account"
            onChange={(accountStatus) =>
              setFilters((current) => ({
                ...current,
                accountStatus: accountStatus as AccountStatus | ""
              }))
            }
            options={accountStatuses}
            value={filters.accountStatus}
          />
          <SelectFilter
            label="Employment"
            onChange={(employmentStatus) =>
              setFilters((current) => ({
                ...current,
                employmentStatus: employmentStatus as EmploymentStatus | ""
              }))
            }
            options={employmentStatuses}
            value={filters.employmentStatus}
          />
          <SelectFilter
            label="Profile"
            onChange={(profileStatus) =>
              setFilters((current) => ({
                ...current,
                profileStatus: profileStatus as ProfileStatus | ""
              }))
            }
            options={profileStatuses}
            value={filters.profileStatus}
          />
          <SelectFilter
            label="Block"
            onChange={(blockStatus) =>
              setFilters((current) => ({
                ...current,
                blockStatus: blockStatus as BlockStatus | ""
              }))
            }
            options={blockStatuses}
            value={filters.blockStatus}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing {filteredUsers.length} of {users.length} users
          </span>
          <Button
            className="h-9 rounded-xl"
            onClick={() =>
              setFilters({
                q: "",
                role: "",
                accountStatus: "",
                employmentStatus: "",
                profileStatus: "",
                blockStatus: ""
              })
            }
            type="button"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      </section>

      <UsersStateView
        onOpenUser={setSelectedUserId}
        state={state}
        users={filteredUsers}
      />

      {selectedUserId ? (
        <OperationalUserProfileModal
          onClose={() => setSelectedUserId(null)}
          onUpdated={() => void loadUsers()}
          userId={selectedUserId}
        />
      ) : null}
    </div>
  );
}

async function fetchAllUsers() {
  const pageSize = 100;
  const firstPage = await usersApi.list({ page: 1, pageSize });
  const users = [...firstPage.items];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const response = await usersApi.list({ page, pageSize });
    users.push(...response.items);
  }

  return users;
}

function UsersStateView({
  onOpenUser,
  state,
  users
}: {
  onOpenUser: (id: string) => void;
  state: AsyncState<SafeUser[]>;
  users: SafeUser[];
}) {
  if (state.status === "loading") {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-orange-600" />
          Loading users
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {state.error}
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <UserRound className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">No users match these filters.</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">IDs</th>
              <th className="px-4 py-3">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-orange-50/45"
                key={user.id}
                onClick={() => onOpenUser(user.id)}
                tabIndex={0}
              >
                <td className="px-4 py-3">
                  <UserIdentity user={user} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={user.role} tone="orange" />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={user.accountStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={user.employmentStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={user.profileStatus} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <p>{user.shopperId ?? "No Shopper ID"}</p>
                  <p>{user.ibsId ?? "No IBS ID"}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {formatDateTime(user.lastLoginAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {users.map((user) => (
          <button
            className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/35"
            key={user.id}
            onClick={() => onOpenUser(user.id)}
            type="button"
          >
            <UserIdentity user={user} />
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill status={user.role} tone="orange" />
              <StatusPill status={user.accountStatus} />
              <StatusPill status={user.employmentStatus} />
              <StatusPill status={user.profileStatus} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function UserIdentity({ user }: { user: SafeUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
        {getInitials(user.nameEn)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-950">{user.nameEn}</p>
        <p className="truncate text-xs text-slate-500">
          {user.phoneNumber} · {user.nameAr ?? "No Arabic name"}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
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
    <label className="grid gap-1.5 text-xs font-semibold uppercase text-slate-500">
      {label}
      <select
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium normal-case text-slate-700"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatEnum(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({
  status,
  tone
}: {
  status: string;
  tone?: "orange";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        tone === "orange"
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : getStatusTone(status)
      )}
    >
      {formatEnum(status)}
    </span>
  );
}

function getStatusTone(status: string) {
  if (["ACTIVE", "COMPLETE", "NO_BLOCK"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["INACTIVE", "NEW_HIRE_PENDING", "INCOMPLETE", "PENDING_REVIEW"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["SUSPENDED", "ARCHIVED", "RESIGNED", "TERMINATED", "PERMANENT_BLOCK", "TEMPORARY_BLOCK"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function filterUsers(
  users: SafeUser[],
  filters: {
    q: string;
    role: UserRole | "";
    accountStatus: AccountStatus | "";
    employmentStatus: EmploymentStatus | "";
    profileStatus: ProfileStatus | "";
    blockStatus: BlockStatus | "";
  }
) {
  const query = filters.q.trim().toLowerCase();

  return users.filter((user) => {
    const matchesQuery =
      !query ||
      [
        user.nameEn,
        user.nameAr,
        user.phoneNumber,
        user.nationalId,
        user.shopperId,
        user.ibsId
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));

    return (
      matchesQuery &&
      (!filters.role || user.role === filters.role) &&
      (!filters.accountStatus || user.accountStatus === filters.accountStatus) &&
      (!filters.employmentStatus ||
        user.employmentStatus === filters.employmentStatus) &&
      (!filters.profileStatus || user.profileStatus === filters.profileStatus) &&
      (!filters.blockStatus || user.blockStatus === filters.blockStatus)
    );
  });
}

function buildStats(users: SafeUser[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.accountStatus === "ACTIVE").length,
    complete: users.filter((user) => user.profileStatus === "COMPLETE").length,
    archived: users.filter((user) => user.accountStatus === "ARCHIVED").length
  };
}

function exportUsersCsv(users: SafeUser[]) {
  const columns: Array<[string, (user: SafeUser) => string | null]> = [
    ["id", (user) => user.id],
    ["role", (user) => user.role],
    ["nameEn", (user) => user.nameEn],
    ["nameAr", (user) => user.nameAr],
    ["phoneNumber", (user) => user.phoneNumber],
    ["shopperId", (user) => user.shopperId],
    ["ibsId", (user) => user.ibsId],
    ["nationalId", (user) => user.nationalId],
    ["accountStatus", (user) => user.accountStatus],
    ["employmentStatus", (user) => user.employmentStatus],
    ["profileStatus", (user) => user.profileStatus],
    ["blockStatus", (user) => user.blockStatus],
    ["joiningDate", (user) => user.joiningDate],
    ["lastLoginAt", (user) => user.lastLoginAt],
    ["createdAt", (user) => user.createdAt]
  ];
  const rows = [
    columns.map(([label]) => label),
    ...users.map((user) => columns.map(([, getter]) => getter(user) ?? ""))
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `supernova-users-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
