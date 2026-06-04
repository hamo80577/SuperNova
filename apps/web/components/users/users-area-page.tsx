import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Columns3,
  Eye,
  LayoutGrid,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Rows3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  activeDirectoryChips,
  directoryPlaceholder,
  directoryToolbarFilters,
  movementKpiCards,
  roleSelectorCards,
  userDirectoryRows,
  usersPaginationPlaceholder,
  usersResetHeader
} from "./users-reset-scaffold";

type RoleCard = (typeof roleSelectorCards)[number];
type KpiCard = (typeof movementKpiCards)[number];
type KpiTone = KpiCard["tone"];
type UserDirectoryRow = (typeof userDirectoryRows)[number];

const roleIcons = {
  champs: UserRound,
  management: ShieldCheck,
  pickers: UsersRound
} satisfies Record<RoleCard["id"], LucideIcon>;

const kpiToneStyles = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    line: "bg-blue-500",
    trend: "text-blue-600"
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    line: "bg-emerald-500",
    trend: "text-emerald-600"
  },
  green: {
    icon: "bg-green-50 text-green-600",
    line: "bg-green-500",
    trend: "text-green-600"
  },
  orange: {
    icon: "bg-orange-50 text-orange-600",
    line: "bg-orange-500",
    trend: "text-orange-600"
  },
  red: {
    icon: "bg-red-50 text-red-600",
    line: "bg-red-500",
    trend: "text-red-600"
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    line: "bg-violet-500",
    trend: "text-violet-600"
  }
} satisfies Record<
  KpiTone,
  {
    icon: string;
    line: string;
    trend: string;
  }
>;

const sparklineHeights = [8, 14, 11, 18, 15, 22] as const;

export function UsersAreaPage() {
  return (
    <main className="grid min-w-0 gap-4 lg:gap-5">
      <UsersPageHeader />
      <RoleSelectorCards />
      <MovementKpiCards />
      <UserDirectory />
    </main>
  );
}

function UsersPageHeader() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            {usersResetHeader.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {usersResetHeader.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            aria-disabled="true"
            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-white"
            type="button"
            variant="outline"
          >
            <CalendarDays className="mr-2 h-4 w-4 text-primary" />
            This month
          </Button>
          <Button
            aria-disabled="true"
            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-white"
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-slate-500" />
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

function RoleSelectorCards() {
  return (
    <section aria-label="User role selector" className="grid gap-3 sm:grid-cols-3">
      {roleSelectorCards.map((card) => {
        const Icon = roleIcons[card.id];

        return (
          <button
            aria-pressed={card.active}
            className={cn(
              "min-h-[92px] rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
              card.active
                ? "border-primary/25 bg-brand-soft shadow-[0_16px_30px_rgba(249,115,22,0.12)]"
                : "border-slate-200 hover:border-slate-300"
            )}
            key={card.id}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                  card.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-50 text-slate-500"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <Badge
                className={cn(
                  "border-transparent px-2 py-0.5 text-[11px]",
                  card.active
                    ? "bg-white text-primary"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {card.count}
              </Badge>
            </span>
            <span className="mt-3 block text-sm font-semibold text-slate-950">
              {card.title}
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              {card.subtitle}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function MovementKpiCards() {
  return (
    <section
      aria-label="Workforce movement"
      className="grid gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
    >
      {movementKpiCards.map((card) => (
        <MovementKpiCard card={card} key={card.id} />
      ))}
    </section>
  );
}

function MovementKpiCard({ card }: { card: KpiCard }) {
  const tone = kpiToneStyles[card.tone];

  return (
    <article className="min-h-[148px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            tone.icon
          )}
        >
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-700">
            {card.label}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
            {card.helper}
          </p>
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">
        {card.value}
      </p>
      <div aria-hidden="true" className="mt-3 flex h-7 items-end gap-1">
        {sparklineHeights.map((height, index) => (
          <span
            className={cn("w-full rounded-full opacity-80", tone.line)}
            key={`${card.id}-${height}-${index}`}
            style={{ height }}
          />
        ))}
      </div>
      <p className={cn("mt-3 text-xs font-medium", tone.trend)}>
        {card.trend}
      </p>
    </article>
  );
}

function UserDirectory() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="grid gap-4 border-b border-slate-100 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">
            {directoryPlaceholder.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {directoryPlaceholder.description}
          </p>
        </div>
        <DirectoryToolbar />
      </div>

      <ActiveFilterChips />
      <DesktopDirectoryTable />
      <MobileDirectoryCards />
      <DirectoryPagination />
    </section>
  );
}

function DirectoryToolbar() {
  return (
    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(240px,1fr)_auto] xl:min-w-[760px] xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto_auto_auto_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search users</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <Input
          className="h-11 rounded-xl border-slate-200 bg-white pl-9 pr-3 shadow-none placeholder:text-slate-400"
          placeholder="Search by name, phone, shopper ID, branch..."
          readOnly
          type="search"
        />
      </label>

      <Button
        aria-disabled="true"
        className="h-11 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-white"
        type="button"
        variant="outline"
      >
        <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-500" />
        Filters
      </Button>

      {directoryToolbarFilters.map((filter) => (
        <button
          aria-disabled="true"
          className="flex h-11 min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 shadow-sm"
          key={filter.label}
          type="button"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-normal text-slate-400">
              {filter.label}
            </span>
            <span className="block truncate">{filter.value}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      ))}

      <Button
        aria-disabled="true"
        className="h-11 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-white"
        type="button"
        variant="outline"
      >
        <Columns3 className="mr-2 h-4 w-4 text-slate-500" />
        Columns
      </Button>

      <div className="grid h-11 grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          aria-pressed="true"
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2 text-xs font-semibold text-primary shadow-sm"
          type="button"
        >
          <Rows3 className="h-4 w-4" />
          Rows
        </button>
        <button
          aria-pressed="false"
          className="inline-flex items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500"
          type="button"
        >
          <LayoutGrid className="h-4 w-4" />
          Cards
        </button>
      </div>
    </div>
  );
}

function ActiveFilterChips() {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
      {activeDirectoryChips.map((chip) => (
        <Badge
          className="border-slate-200 bg-slate-50 text-[11px] text-slate-600"
          key={chip}
          variant="outline"
        >
          {chip}
        </Badge>
      ))}
      <button
        className="h-7 rounded-lg px-2 text-xs font-semibold text-primary"
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}

function DesktopDirectoryTable() {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1020px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <th className="w-10 px-4 py-3">
              <input
                aria-label="Select all users"
                className="h-4 w-4 rounded border-slate-300 text-primary"
                disabled
                type="checkbox"
              />
            </th>
            <th className="px-3 py-3">User</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Operational Context</th>
            <th className="px-3 py-3">Manager</th>
            <th className="px-3 py-3">Lifecycle</th>
            <th className="px-3 py-3">Contact</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {userDirectoryRows.map((row) => (
            <DirectoryTableRow key={`${row.name}-${row.idLabel}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectoryTableRow({ row }: { row: UserDirectoryRow }) {
  return (
    <tr className="text-sm text-slate-700">
      <td className="px-4 py-3 align-middle">
        <input
          aria-label={`Select ${row.name}`}
          className="h-4 w-4 rounded border-slate-300 text-primary"
          disabled
          type="checkbox"
        />
      </td>
      <td className="px-3 py-3 align-middle">
        <UserIdentity row={row} />
      </td>
      <td className="px-3 py-3 align-middle">
        <RoleBadge role={row.role} />
      </td>
      <td className="px-3 py-3 align-middle">
        <OperationalContext row={row} />
      </td>
      <td className="px-3 py-3 align-middle">
        <ManagerCell row={row} />
      </td>
      <td className="px-3 py-3 align-middle">
        <LifecycleBadge lifecycle={row.lifecycle} />
      </td>
      <td className="px-3 py-3 align-middle">
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-600">
          <Phone className="h-4 w-4 text-slate-400" />
          {row.contact}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            aria-disabled="true"
            className="h-9 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-white"
            type="button"
            variant="outline"
          >
            <Eye className="mr-2 h-4 w-4 text-slate-500" />
            View
          </Button>
          <Button
            aria-disabled="true"
            aria-label={`More actions for ${row.name}`}
            className="h-9 w-9 rounded-xl border-slate-200 bg-white p-0 text-slate-500 hover:bg-white"
            type="button"
            variant="outline"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MobileDirectoryCards() {
  return (
    <div className="grid gap-3 p-3 lg:hidden">
      {userDirectoryRows.map((row) => (
        <article
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          key={`${row.name}-${row.idLabel}`}
        >
          <div className="flex items-start justify-between gap-3">
            <UserIdentity row={row} />
            <LifecycleBadge lifecycle={row.lifecycle} />
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                Role
              </span>
              <RoleBadge role={row.role} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                Operational Context
              </span>
              <div className="mt-1">
                <OperationalContext row={row} />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
                Manager
              </span>
              <div className="mt-1">
                <ManagerCell row={row} />
              </div>
            </div>
            <div className="flex items-center gap-2 font-medium text-slate-600">
              <Phone className="h-4 w-4 text-slate-400" />
              {row.contact}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
            <Button
              aria-disabled="true"
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-white"
              type="button"
              variant="outline"
            >
              <Eye className="mr-2 h-4 w-4 text-slate-500" />
              View
            </Button>
            <Button
              aria-disabled="true"
              aria-label={`More actions for ${row.name}`}
              className="h-11 rounded-xl border-slate-200 bg-white p-0 text-slate-500 hover:bg-white"
              type="button"
              variant="outline"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function DirectoryPagination() {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm font-medium text-slate-500">
        {usersPaginationPlaceholder.rangeLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-disabled="true"
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400"
          type="button"
        >
          <span className="sr-only">Previous page</span>
          <ChevronDown className="h-4 w-4 rotate-90" />
        </button>
        {[1, 2, 3, 4, 5].map((page) => (
          <button
            aria-current={
              page === usersPaginationPlaceholder.page ? "page" : undefined
            }
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl border text-sm font-semibold",
              page === usersPaginationPlaceholder.page
                ? "border-primary/30 bg-brand-soft text-primary"
                : "border-slate-200 bg-white text-slate-600"
            )}
            key={page}
            type="button"
          >
            {page}
          </button>
        ))}
        <span className="px-1 text-sm font-semibold text-slate-400">...</span>
        <button
          className="grid h-9 min-w-10 place-items-center rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-600"
          type="button"
        >
          153
        </button>
        <button
          aria-disabled="true"
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500"
          type="button"
        >
          <span className="sr-only">Next page</span>
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
        <button
          aria-disabled="true"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
          type="button"
        >
          {usersPaginationPlaceholder.pageSize} / page
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

function UserIdentity({ row }: { row: UserDirectoryRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
        {getInitials(row.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-950">
          {row.name}
        </span>
        <span className="block truncate text-xs font-medium text-slate-500">
          {row.idLabel}
        </span>
      </span>
    </div>
  );
}

function OperationalContext({ row }: { row: UserDirectoryRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-800">
        {row.context.branch}
      </p>
      <p className="truncate text-xs font-medium text-slate-500">
        {row.context.chain}
      </p>
      <p className="truncate text-xs text-slate-400">{row.context.since}</p>
    </div>
  );
}

function ManagerCell({ row }: { row: UserDirectoryRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-primary">
        {getInitials(row.manager)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-800">
          {row.manager}
        </span>
        <span className="block truncate text-xs font-medium text-slate-500">
          {row.managerRole}
        </span>
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role: UserDirectoryRow["role"] }) {
  return (
    <Badge
      className={cn(
        "border-transparent text-[11px]",
        role === "Picker" && "bg-orange-50 text-orange-700",
        role === "Champ" && "bg-violet-50 text-violet-700",
        role === "Area Manager" && "bg-blue-50 text-blue-700"
      )}
    >
      {role}
    </Badge>
  );
}

function LifecycleBadge({
  lifecycle
}: {
  lifecycle: UserDirectoryRow["lifecycle"];
}) {
  const isActive = lifecycle === "Active";

  return (
    <Badge
      className={cn(
        "gap-1.5 border-transparent text-[11px]",
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-orange-50 text-orange-700"
      )}
    >
      {isActive ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <BriefcaseBusiness className="h-3.5 w-3.5" />
      )}
      {lifecycle}
    </Badge>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
