"use client";

import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Eye,
  LayoutGrid,
  Loader2,
  Phone,
  RefreshCw,
  Rows3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { NewRequestSheet } from "@/components/requests/forms/new-request-sheet";
import {
  type InitialTransferPicker,
  type NewRequestDraft
} from "@/components/requests/shared/request-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { adminOrganizationApi } from "@/lib/api/admin-organization";
import {
  usersApi,
  type ListUsersParams,
  type OperationalProfileResponse,
  type UserLookupStatus
} from "@/lib/api/users";
import { type UserSummary, workspacesApi } from "@/lib/api/workspaces";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { OperationalUserProfileModal } from "./operational-user-profile-modal";
import { UserAvatar } from "./user-avatar";
import {
  getAllowedResignationTargetRoles,
  isResignationTargetRole,
  UsersActionsMenu,
  type UsersActionHandlers
} from "./users-actions-menu";
import {
  getUsersSectionLabel,
  getVisibleUserSections,
  isAdminUsersRole,
  keepUsersSectionItems,
  usersManagementRoles
} from "./users-area-data";
import type {
  FilterOption,
  UsersAreaData,
  UsersAreaItem,
  UsersFilterKey,
  UsersFilterOptions,
  UsersFilters,
  UsersSectionId,
  ViewMode
} from "./users-area-types";
import {
  formatDate,
  formatEnum,
  getItemChainName,
  getUserOperationalStatus
} from "./users-display-utils";

type UsersAreaState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: UsersAreaData; error?: never };

type DirectoryFilterKey = UsersFilterKey | "status";
type DirectoryFilters = UsersFilters & {
  status: "" | UserLookupStatus;
};

type ActiveSectionResult = {
  items: UsersAreaItem[];
  page: number;
  total: number;
  totalPages: number;
};

type KpiTone = "blue" | "emerald" | "green" | "orange" | "red" | "violet";

const PAGE_SIZE = 10;
const emptyFilters: DirectoryFilters = {
  areaManagerId: "",
  chainId: "",
  champId: "",
  status: "",
  vendorId: ""
};
const initialPages: Record<UsersSectionId, number> = {
  champs: 1,
  management: 1,
  pickers: 1
};

const roleIcons = {
  champs: UserRound,
  management: ShieldCheck,
  pickers: UsersRound
} satisfies Record<UsersSectionId, LucideIcon>;

const movementKpiCards: Array<{
  helper: string;
  id: string;
  label: string;
  tone: KpiTone;
}> = [
  {
    helper: "Needs workforce summary endpoint",
    id: "starting-headcount",
    label: "Starting Headcount",
    tone: "blue"
  },
  {
    helper: "Needs completed onboarding period data",
    id: "new-hires",
    label: "New Hires",
    tone: "green"
  },
  {
    helper: "Needs completed exit period data",
    id: "exited",
    label: "Exited",
    tone: "red"
  },
  {
    helper: "Needs end-of-period assignment snapshot",
    id: "ending-headcount",
    label: "Ending Headcount",
    tone: "violet"
  },
  {
    helper: "Do not calculate from visible rows",
    id: "attrition-rate",
    label: "Attrition Rate",
    tone: "orange"
  },
  {
    helper: "Needs hires minus exits for selected scope",
    id: "net-movement",
    label: "Net Movement",
    tone: "emerald"
  }
];

const kpiToneStyles = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    line: "bg-blue-200"
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    line: "bg-emerald-200"
  },
  green: {
    icon: "bg-green-50 text-green-600",
    line: "bg-green-200"
  },
  orange: {
    icon: "bg-orange-50 text-orange-600",
    line: "bg-orange-200"
  },
  red: {
    icon: "bg-red-50 text-red-600",
    line: "bg-red-200"
  },
  violet: {
    icon: "bg-violet-50 text-violet-600",
    line: "bg-violet-200"
  }
} satisfies Record<KpiTone, { icon: string; line: string }>;

const statusOptions: Array<{ label: string; value: "" | UserLookupStatus }> = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Archived", value: "ARCHIVED" }
];

const sparklineHeights = [8, 14, 11, 18, 15, 22] as const;

export function UsersAreaPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersAreaState>({ status: "loading" });
  const [activeSection, setActiveSection] = useState<UsersSectionId>("pickers");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
  const [pageBySection, setPageBySection] =
    useState<Record<UsersSectionId, number>>(initialPages);
  const [viewMode, setViewMode] = useState<ViewMode>("rows");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState<NewRequestDraft | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const viewerIsAdmin = isAdminUsersRole(user?.role);
  const visibleSections = useMemo(
    () => getVisibleUserSections(user?.role),
    [user?.role]
  );
  const data = state.status === "ready" ? state.data : emptyUsersAreaData();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const firstVisibleSection = visibleSections[0]?.id;
    if (
      firstVisibleSection &&
      !visibleSections.some((section) => section.id === activeSection)
    ) {
      setActiveSection(firstVisibleSection);
    }
  }, [activeSection, visibleSections]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let alive = true;

    async function loadUsersArea() {
      setState({ status: "loading" });
      setRequestError(null);

      try {
        const nextData = await fetchUsersAreaData(currentUser, {
          filters,
          pageBySection,
          query: debouncedQuery
        });

        if (alive) {
          setState({ status: "ready", data: nextData });
        }
      } catch (caughtError) {
        if (alive) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Users area."
          });
        }
      }
    }

    void loadUsersArea();

    return () => {
      alive = false;
    };
  }, [
    user,
    debouncedQuery,
    filters.areaManagerId,
    filters.chainId,
    filters.champId,
    filters.status,
    filters.vendorId,
    pageBySection.champs,
    pageBySection.management,
    pageBySection.pickers,
    refreshToken
  ]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [searchParams]);

  const sectionCounts = getSectionCounts(
    data,
    filters,
    debouncedQuery,
    viewerIsAdmin
  );
  const activeResult = getActiveSectionResult({
    data,
    filters,
    isServerDriven: viewerIsAdmin,
    page: pageBySection[activeSection],
    query: debouncedQuery,
    section: activeSection
  });
  const selectedItem =
    [...data.pickers, ...data.champs, ...data.management].find(
      (item) => item.user.id === selectedUserId
    ) ?? null;
  const selectedUser = selectedItem?.user ?? null;
  const allowedResignationRoles = getAllowedResignationTargetRoles(user?.role);
  const showAdminFilters = viewerIsAdmin;

  function refreshUsersArea() {
    setRefreshToken((current) => current + 1);
  }

  function resetPages() {
    setPageBySection(initialPages);
  }

  function updateFilter(key: DirectoryFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetPages();
  }

  function clearFilter(key: DirectoryFilterKey) {
    updateFilter(key, "");
  }

  function clearAllFilters() {
    setFilters(emptyFilters);
    resetPages();
  }

  function selectSection(section: UsersSectionId) {
    setActiveSection(section);
    setOpenActionMenu(null);
    setPageBySection((current) => ({ ...current, [section]: 1 }));
  }

  function updateQuery(value: string) {
    setQuery(value);
    resetPages();
  }

  function openResignation(target: UserSummary | SafeUser) {
    setRequestError(null);

    if (!isResignationTargetRole(target.role)) {
      return;
    }

    setRequestDraft({
      initialUser: {
        id: target.id,
        nameEn: target.nameEn,
        phoneNumber: target.phoneNumber,
        role: target.role
      },
      targetRole: target.role,
      type: "RESIGNATION"
    });
  }

  async function openTransfer(target: UsersAreaItem) {
    setRequestError(null);

    if (target.user.role !== "PICKER") {
      setRequestError("Transfer is available only for Pickers.");
      return;
    }

    const activeAssignments = data.pickers.filter(
      (item) =>
        item.user.id === target.user.id && item.assignment?.status === "ACTIVE"
    );

    if (activeAssignments.length > 1) {
      setRequestError(
        "This Picker has multiple active Branch assignments in the current view. Resolve assignment data before starting Transfer."
      );
      return;
    }

    let transferTarget =
      target.assignment?.status === "ACTIVE"
        ? target
        : activeAssignments[0] ?? target;

    if (transferTarget.assignment?.status !== "ACTIVE") {
      try {
        transferTarget = toUsersAreaItemFromProfile(
          await usersApi.operationalProfile(target.user.id)
        );
      } catch {
        transferTarget = target;
      }
    }

    setRequestDraft({
      initialPicker: toInitialTransferPicker(transferTarget),
      type: "TRANSFER"
    });
  }

  function handleCreated() {
    setRequestDraft(null);
    refreshUsersArea();
  }

  const userActions: UsersActionHandlers = {
    activeMenuKey: openActionMenu,
    onOpenResignation: openResignation,
    onOpenTransfer: (item) => void openTransfer(item),
    onToggleMenu: (key) =>
      setOpenActionMenu((current) => (current === key ? null : key)),
    viewerRole: user?.role
  };

  return (
    <main className="grid min-w-0 gap-4 lg:gap-5">
      <UsersPageHeader
        loading={state.status === "loading"}
        onRefresh={refreshUsersArea}
      />
      <RoleSelectorCards
        activeSection={activeSection}
        counts={sectionCounts}
        loading={state.status === "loading"}
        onSelect={selectSection}
        sections={visibleSections}
      />
      <MovementKpiCards />
      <UserDirectory
        activeResult={activeResult}
        activeSection={activeSection}
        actions={userActions}
        error={state.status === "error" ? state.error : null}
        filters={filters}
        filtersOpen={filtersOpen}
        loading={state.status === "loading"}
        onChangeFilter={updateFilter}
        onClearAllFilters={clearAllFilters}
        onClearFilter={clearFilter}
        onOpenProfile={setSelectedUserId}
        onPageChange={(page) =>
          setPageBySection((current) => ({
            ...current,
            [activeSection]: page
          }))
        }
        onQueryChange={updateQuery}
        onRetry={refreshUsersArea}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        onViewModeChange={setViewMode}
        options={data.filters}
        query={query}
        sectionLabel={getUsersSectionLabel(activeSection, user?.role)}
        showAdminFilters={showAdminFilters}
        viewMode={viewMode}
      />

      {requestError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {requestError}
        </div>
      ) : null}

      {selectedUserId ? (
        <OperationalUserProfileModal
          actions={{
            onResignation:
              selectedUser &&
              isResignationTargetRole(selectedUser.role) &&
              allowedResignationRoles.includes(selectedUser.role)
                ? () => openResignation(selectedUser)
                : undefined,
            onTransfer:
              selectedItem?.user.role === "PICKER" || !selectedItem
                ? (_profileUser, profile) => {
                    if (profile) {
                      void openTransfer(toUsersAreaItemFromProfile(profile));
                    } else if (selectedItem) {
                      void openTransfer(selectedItem);
                    }
                  }
                : undefined
          }}
          allowDirectProfileMutation={false}
          onClose={() => setSelectedUserId(null)}
          onUpdated={refreshUsersArea}
          userId={selectedUserId}
        />
      ) : null}

      {requestDraft ? (
        <NewRequestSheet
          draft={requestDraft}
          onClose={() => setRequestDraft(null)}
          onCreated={handleCreated}
        />
      ) : null}
    </main>
  );
}

function UsersPageHeader({
  loading,
  onRefresh
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            Users
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Operational workforce, assignments, and lifecycle movement.
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
            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"
            disabled={loading}
            onClick={onRefresh}
            type="button"
            variant="outline"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4 text-slate-500" />
            )}
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

function RoleSelectorCards({
  activeSection,
  counts,
  loading,
  onSelect,
  sections
}: {
  activeSection: UsersSectionId;
  counts: Record<UsersSectionId, number>;
  loading: boolean;
  onSelect: (section: UsersSectionId) => void;
  sections: ReturnType<typeof getVisibleUserSections>;
}) {
  if (!sections.length) {
    return null;
  }

  return (
    <section
      aria-label="User role selector"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {sections.map((card) => {
        const Icon = roleIcons[card.id];
        const active = activeSection === card.id;

        return (
          <button
            aria-pressed={active}
            className={cn(
              "min-h-[92px] rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              active
                ? "border-primary/25 bg-brand-soft shadow-[0_16px_30px_rgba(249,115,22,0.12)]"
                : "border-slate-200 hover:border-slate-300"
            )}
            key={card.id}
            onClick={() => onSelect(card.id)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-slate-50 text-slate-500"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <Badge
                className={cn(
                  "border-transparent px-2 py-0.5 text-[11px]",
                  active
                    ? "bg-white text-primary"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {loading ? "..." : formatCount(counts[card.id])}
              </Badge>
            </span>
            <span className="mt-3 block text-sm font-semibold text-slate-950">
              {card.label}
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

function MovementKpiCard({ card }: { card: (typeof movementKpiCards)[number] }) {
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
          <p className="mt-0.5 line-clamp-2 text-[11px] font-medium text-slate-400">
            {card.helper}
          </p>
        </div>
      </div>
      <p className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
        Coming soon
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
      <p className="mt-3 text-xs font-medium text-slate-500">
        Pending real workforce summary
      </p>
    </article>
  );
}

function UserDirectory({
  actions,
  activeResult,
  activeSection,
  error,
  filters,
  filtersOpen,
  loading,
  onChangeFilter,
  onClearAllFilters,
  onClearFilter,
  onOpenProfile,
  onPageChange,
  onQueryChange,
  onRetry,
  onToggleFilters,
  onViewModeChange,
  options,
  query,
  sectionLabel,
  showAdminFilters,
  viewMode
}: {
  actions: UsersActionHandlers;
  activeResult: ActiveSectionResult;
  activeSection: UsersSectionId;
  error: string | null;
  filters: DirectoryFilters;
  filtersOpen: boolean;
  loading: boolean;
  onChangeFilter: (key: DirectoryFilterKey, value: string) => void;
  onClearAllFilters: () => void;
  onClearFilter: (key: DirectoryFilterKey) => void;
  onOpenProfile: (id: string) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onToggleFilters: () => void;
  onViewModeChange: (value: ViewMode) => void;
  options: UsersFilterOptions;
  query: string;
  sectionLabel: string;
  showAdminFilters: boolean;
  viewMode: ViewMode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="grid gap-4 border-b border-slate-100 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">
            User Directory
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Search, filter, and inspect operational users.
          </p>
        </div>
        <DirectoryToolbar
          filters={filters}
          filtersOpen={filtersOpen}
          onChangeFilter={onChangeFilter}
          onQueryChange={onQueryChange}
          onToggleFilters={onToggleFilters}
          onViewModeChange={onViewModeChange}
          options={options}
          query={query}
          showAdminFilters={showAdminFilters}
          viewMode={viewMode}
        />
      </div>

      <ActiveFilterChips
        filters={filters}
        onClearAll={onClearAllFilters}
        onClearFilter={onClearFilter}
        options={options}
      />

      {loading ? (
        <div className="p-3 sm:p-4">
          <TableRowsSkeleton label="Loading users" rows={6} />
        </div>
      ) : error ? (
        <DirectoryErrorState error={error} onRetry={onRetry} />
      ) : activeResult.items.length ? (
        <>
          <DirectoryResults
            actions={actions}
            items={activeResult.items}
            onOpenProfile={onOpenProfile}
            section={activeSection}
            viewMode={viewMode}
          />
          <DirectoryPagination
            page={activeResult.page}
            pageSize={PAGE_SIZE}
            sectionLabel={sectionLabel}
            total={activeResult.total}
            totalPages={activeResult.totalPages}
            onPageChange={onPageChange}
          />
        </>
      ) : (
        <DirectoryEmptyState sectionLabel={sectionLabel} />
      )}
    </section>
  );
}

function DirectoryToolbar({
  filters,
  filtersOpen,
  onChangeFilter,
  onQueryChange,
  onToggleFilters,
  onViewModeChange,
  options,
  query,
  showAdminFilters,
  viewMode
}: {
  filters: DirectoryFilters;
  filtersOpen: boolean;
  onChangeFilter: (key: DirectoryFilterKey, value: string) => void;
  onQueryChange: (value: string) => void;
  onToggleFilters: () => void;
  onViewModeChange: (value: ViewMode) => void;
  options: UsersFilterOptions;
  query: string;
  showAdminFilters: boolean;
  viewMode: ViewMode;
}) {
  const filterSelectClass = cn(!filtersOpen && "hidden xl:block");

  return (
    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(240px,1fr)_auto] xl:min-w-[880px] xl:grid-cols-[minmax(220px,1fr)_auto_repeat(5,minmax(112px,1fr))_auto_auto]">
      <label className="relative min-w-0">
        <span className="sr-only">Search users</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <Input
          className="h-11 rounded-xl border-slate-200 bg-white pl-9 pr-3 shadow-none placeholder:text-slate-400"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, phone, shopper ID, branch..."
          type="search"
          value={query}
        />
      </label>

      <Button
        aria-expanded={filtersOpen}
        className={cn(
          "h-11 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50",
          hasActiveFilters(filters) &&
            "border-primary/25 bg-brand-soft text-primary hover:bg-brand-soft"
        )}
        onClick={onToggleFilters}
        type="button"
        variant="outline"
      >
        <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-500" />
        Filters
      </Button>

      <FilterSelect
        className={filterSelectClass}
        label="Chain"
        onChange={(value) => onChangeFilter("chainId", value)}
        options={options.chains}
        value={filters.chainId}
      />
      <FilterSelect
        className={filterSelectClass}
        label="Branch"
        onChange={(value) => onChangeFilter("vendorId", value)}
        options={options.vendors}
        value={filters.vendorId}
      />
      {showAdminFilters ? (
        <FilterSelect
          className={filterSelectClass}
          label="Area Manager"
          onChange={(value) => onChangeFilter("areaManagerId", value)}
          options={options.areaManagers}
          value={filters.areaManagerId}
        />
      ) : null}
      <FilterSelect
        className={filterSelectClass}
        label="Champ"
        onChange={(value) => onChangeFilter("champId", value)}
        options={options.champs}
        value={filters.champId}
      />
      <StatusSelect
        className={filterSelectClass}
        onChange={(value) => onChangeFilter("status", value)}
        value={filters.status}
      />

      <Button
        aria-disabled="true"
        className="h-11 rounded-xl border-slate-200 bg-white px-3 text-slate-500 hover:bg-white"
        disabled
        title="Column customization is not part of Phase 1."
        type="button"
        variant="outline"
      >
        <Columns3 className="mr-2 h-4 w-4" />
        Columns
      </Button>

      <div className="grid h-11 grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          aria-pressed={viewMode === "rows"}
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold",
            viewMode === "rows"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
          onClick={() => onViewModeChange("rows")}
          type="button"
        >
          <Rows3 className="h-4 w-4" />
          Rows
        </button>
        <button
          aria-pressed={viewMode === "cards"}
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold",
            viewMode === "cards"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          )}
          onClick={() => onViewModeChange("cards")}
          type="button"
        >
          <LayoutGrid className="h-4 w-4" />
          Cards
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  className,
  label,
  onChange,
  options,
  value
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        className="h-11 rounded-xl border-slate-200 bg-white shadow-sm"
        disabled={!options.length}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
            {option.hint ? ` (${option.hint})` : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}

function StatusSelect({
  className,
  onChange,
  value
}: {
  className?: string;
  onChange: (value: string) => void;
  value: "" | UserLookupStatus;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <span className="sr-only">Status</span>
      <Select
        aria-label="Status"
        className="h-11 rounded-xl border-slate-200 bg-white shadow-sm"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {statusOptions.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function ActiveFilterChips({
  filters,
  onClearAll,
  onClearFilter,
  options
}: {
  filters: DirectoryFilters;
  onClearAll: () => void;
  onClearFilter: (key: DirectoryFilterKey) => void;
  options: UsersFilterOptions;
}) {
  const active = getActiveFilterEntries(filters);

  if (!active.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
      {active.map(([key, value]) => (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:border-primary/25 hover:bg-brand-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          key={key}
          onClick={() => onClearFilter(key)}
          type="button"
        >
          <span className="text-slate-400">{getFilterName(key)}:</span>
          {getFilterLabel(key, value, options)}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <button
        className="h-8 rounded-lg px-2 text-xs font-semibold text-primary"
        onClick={onClearAll}
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}

function DirectoryResults({
  actions,
  items,
  onOpenProfile,
  section,
  viewMode
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  section: UsersSectionId;
  viewMode: ViewMode;
}) {
  if (viewMode === "cards") {
    return (
      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <DirectoryUserCard
            actions={actions}
            item={item}
            key={item.key}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <DesktopDirectoryTable
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
        section={section}
      />
      <MobileDirectoryCards
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}

function DesktopDirectoryTable({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  section: UsersSectionId;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1040px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <th className="px-4 py-3">User</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Operational Context</th>
            <th className="px-3 py-3">Manager</th>
            <th className="px-3 py-3">Lifecycle</th>
            <th className="px-3 py-3">Contact</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <DirectoryTableRow
              actions={actions}
              item={item}
              key={item.key}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectoryTableRow({
  actions,
  item,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  item: UsersAreaItem;
  onOpenProfile: (id: string) => void;
}) {
  return (
    <tr
      className="cursor-pointer text-sm text-slate-700 transition hover:bg-orange-50/30"
      onClick={() => onOpenProfile(item.user.id)}
    >
      <td className="px-4 py-3 align-middle">
        <UserIdentity item={item} />
      </td>
      <td className="px-3 py-3 align-middle">
        <RoleBadge role={item.user.role} />
      </td>
      <td className="px-3 py-3 align-middle">
        <OperationalContext item={item} />
      </td>
      <td className="px-3 py-3 align-middle">
        <ManagerCell item={item} />
      </td>
      <td className="px-3 py-3 align-middle">
        <LifecycleBadge item={item} />
      </td>
      <td className="px-3 py-3 align-middle">
        <ContactCell item={item} />
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            className="h-9 rounded-xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation();
              onOpenProfile(item.user.id);
            }}
            type="button"
            variant="outline"
          >
            <Eye className="mr-2 h-4 w-4 text-slate-500" />
            View
          </Button>
          <UsersActionsMenu {...actions} item={item} />
        </div>
      </td>
    </tr>
  );
}

function MobileDirectoryCards({
  actions,
  items,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 p-3 lg:hidden">
      {items.map((item) => (
        <DirectoryUserCard
          actions={actions}
          item={item}
          key={item.key}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

function DirectoryUserCard({
  actions,
  item,
  onOpenProfile
}: {
  actions: UsersActionHandlers;
  item: UsersAreaItem;
  onOpenProfile: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity item={item} />
        <LifecycleBadge item={item} />
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            Role
          </span>
          <RoleBadge role={item.user.role} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            Operational Context
          </span>
          <div className="mt-1">
            <OperationalContext item={item} />
          </div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            Manager
          </span>
          <div className="mt-1">
            <ManagerCell item={item} />
          </div>
        </div>
        <ContactCell item={item} />
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
        <Button
          className="h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={() => onOpenProfile(item.user.id)}
          type="button"
          variant="outline"
        >
          <Eye className="mr-2 h-4 w-4 text-slate-500" />
          View
        </Button>
        <UsersActionsMenu {...actions} align="right" item={item} />
      </div>
    </article>
  );
}

function UserIdentity({ item }: { item: UsersAreaItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        accountStatus={item.user.accountStatus}
        employmentStatus={item.user.employmentStatus}
        name={item.user.nameEn}
        role={item.user.role}
        size="sm"
        statusTone={getUserOperationalStatus(item).tone}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-950">
          {item.user.nameEn}
        </span>
        <span className="block truncate text-xs font-medium text-slate-500">
          {getUserIdentifier(item.user)}
        </span>
      </span>
    </div>
  );
}

function OperationalContext({ item }: { item: UsersAreaItem }) {
  const context = getOperationalContextDisplay(item);

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-800">
        {context.primary}
      </p>
      <p className="truncate text-xs font-medium text-slate-500">
        {context.secondary}
      </p>
      <p className="truncate text-xs text-slate-400">{context.meta}</p>
    </div>
  );
}

function ManagerCell({ item }: { item: UsersAreaItem }) {
  const manager = getManagerDisplay(item);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-primary">
        {getInitials(manager.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-800">
          {manager.name}
        </span>
        <span className="block truncate text-xs font-medium text-slate-500">
          {manager.role}
        </span>
      </span>
    </div>
  );
}

function ContactCell({ item }: { item: UsersAreaItem }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
      <Phone className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="truncate">{item.user.phoneNumber}</span>
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      className={cn(
        "border-transparent text-[11px]",
        role === "PICKER" && "bg-orange-50 text-orange-700",
        role === "CHAMP" && "bg-violet-50 text-violet-700",
        role === "AREA_MANAGER" && "bg-blue-50 text-blue-700",
        (role === "ADMIN" || role === "SUPER_ADMIN") &&
          "bg-slate-100 text-slate-700"
      )}
    >
      {formatEnum(role)}
    </Badge>
  );
}

function LifecycleBadge({ item }: { item: UsersAreaItem }) {
  const lifecycle = getLifecycleDisplay(item);

  return (
    <Badge
      className={cn(
        "gap-1.5 border-transparent text-[11px]",
        lifecycle.tone === "active" && "bg-emerald-50 text-emerald-700",
        lifecycle.tone === "pending" && "bg-orange-50 text-orange-700",
        lifecycle.tone === "blocked" && "bg-red-50 text-red-700",
        lifecycle.tone === "muted" && "bg-slate-100 text-slate-700"
      )}
      title={lifecycle.title}
    >
      {lifecycle.tone === "active" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <BriefcaseBusiness className="h-3.5 w-3.5" />
      )}
      {lifecycle.label}
    </Badge>
  );
}

function DirectoryPagination({
  onPageChange,
  page,
  pageSize,
  sectionLabel,
  total,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  sectionLabel: string;
  total: number;
  totalPages: number;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm font-medium text-slate-500">
        {sectionLabel}: showing {from} to {to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:text-slate-300"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          type="button"
        >
          <span className="sr-only">Previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            aria-current={pageNumber === page ? "page" : undefined}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl border text-sm font-semibold",
              pageNumber === page
                ? "border-primary/30 bg-brand-soft text-primary"
                : "border-slate-200 bg-white text-slate-600"
            )}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            type="button"
          >
            {pageNumber}
          </button>
        ))}
        <button
          className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:text-slate-300"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          type="button"
        >
          <span className="sr-only">Next page</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
          {pageSize} / page
        </span>
      </div>
    </div>
  );
}

function DirectoryErrorState({
  error,
  onRetry
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-56 place-items-center p-6 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Users could not be loaded.
        </p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{error}</p>
        <Button className="mt-4 rounded-xl" onClick={onRetry} type="button">
          Retry
        </Button>
      </div>
    </div>
  );
}

function DirectoryEmptyState({ sectionLabel }: { sectionLabel: string }) {
  return (
    <div className="grid min-h-56 place-items-center p-6 text-center">
      <div>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 text-slate-400">
          <UsersRound className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          No {sectionLabel.toLowerCase()} found.
        </p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
          Users appear here when assignment data puts them inside the selected
          scope.
        </p>
      </div>
    </div>
  );
}

async function fetchUsersAreaData(
  currentUser: SafeUser,
  params: {
    filters: DirectoryFilters;
    pageBySection: Record<UsersSectionId, number>;
    query: string;
  }
): Promise<UsersAreaData> {
  if (currentUser.role === "CHAMP") {
    const workspace = await workspacesApi.champBranches();
    const currentChamp = toUserSummaryFromSafeUser(currentUser);
    const pickers = workspace.branches.flatMap((branch) =>
      branch.pickers.map((picker) => ({
        assignment: picker.assignment,
        chain: branch.chain,
        champ: currentChamp,
        key: picker.assignment.id,
        pendingRequest: picker.pendingRequest ?? null,
        user: picker.picker,
        vendor: branch.vendor
      }))
    );

    return {
      champs: [],
      filters: filterOptionsFromScopedItems(pickers),
      management: [],
      meta: {},
      pickers: keepUsersSectionItems("pickers", pickers)
    };
  }

  if (currentUser.role === "AREA_MANAGER") {
    const workspace = await workspacesApi.areaManager();
    const areaManager = workspace.areaManager;
    const pickers = workspace.chains.flatMap((chain) =>
      chain.vendors.flatMap((vendor) =>
        vendor.pickers.map((picker) => ({
          areaManager,
          assignment: picker.assignment,
          chain: chain.chain,
          champ: vendor.champs[0]?.champ ?? null,
          key: picker.assignment.id,
          pendingRequest: picker.pendingRequest ?? null,
          user: picker.picker,
          vendor: vendor.vendor
        }))
      )
    );
    const champs = workspace.chains.flatMap((chain) =>
      chain.vendors.flatMap((vendor) =>
        vendor.champs.map((champ) => ({
          areaManager,
          assignment: champ.assignment,
          chain: chain.chain,
          champ: champ.champ,
          key: champ.assignment.id,
          pendingRequest: champ.pendingRequest ?? null,
          user: champ.champ,
          vendor: vendor.vendor
        }))
      )
    );
    const scopedItems = [...pickers, ...champs];

    return {
      champs: keepUsersSectionItems("champs", champs),
      filters: filterOptionsFromScopedItems(scopedItems),
      management: [],
      meta: {},
      pickers: keepUsersSectionItems("pickers", pickers)
    };
  }

  if (isAdminUsersRole(currentUser.role)) {
    const apiFilters = toApiFilters(params.filters);
    const [pickers, champs, management, organization] = await Promise.all([
      usersApi.operationalList({
        page: params.pageBySection.pickers,
        pageSize: PAGE_SIZE,
        q: params.query,
        role: "PICKER",
        ...apiFilters
      }),
      usersApi.operationalList({
        page: params.pageBySection.champs,
        pageSize: PAGE_SIZE,
        q: params.query,
        role: "CHAMP",
        ...apiFilters
      }),
      usersApi.operationalList({
        page: params.pageBySection.management,
        pageSize: PAGE_SIZE,
        q: params.query,
        roles: usersManagementRoles,
        ...apiFilters
      }),
      adminOrganizationApi.get()
    ]);

    return {
      champs: keepUsersSectionItems("champs", champs.items),
      filters: filterOptionsFromAdminOrganization(organization.chains),
      management: keepUsersSectionItems("management", management.items),
      meta: {
        champs: champs.meta,
        management: management.meta,
        pickers: pickers.meta
      },
      pickers: keepUsersSectionItems("pickers", pickers.items)
    };
  }

  return emptyUsersAreaData();
}

function getActiveSectionResult({
  data,
  filters,
  isServerDriven,
  page,
  query,
  section
}: {
  data: UsersAreaData;
  filters: DirectoryFilters;
  isServerDriven: boolean;
  page: number;
  query: string;
  section: UsersSectionId;
}): ActiveSectionResult {
  const guardedItems = keepUsersSectionItems(section, data[section]);

  if (isServerDriven) {
    const meta = data.meta[section];
    const totalPages = meta?.totalPages ?? 1;
    const safePage = clampPage(page, totalPages);

    return {
      items: guardedItems,
      page: safePage,
      total: meta?.total ?? guardedItems.length,
      totalPages
    };
  }

  const filtered = applyClientFilters(filterItems(guardedItems, query), filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = clampPage(page, totalPages);

  return {
    items: filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    page: safePage,
    total: filtered.length,
    totalPages
  };
}

function getSectionCounts(
  data: UsersAreaData,
  filters: DirectoryFilters,
  query: string,
  serverDriven: boolean
): Record<UsersSectionId, number> {
  if (serverDriven) {
    return {
      champs:
        data.meta.champs?.total ?? keepUsersSectionItems("champs", data.champs).length,
      management:
        data.meta.management?.total ??
        keepUsersSectionItems("management", data.management).length,
      pickers:
        data.meta.pickers?.total ??
        keepUsersSectionItems("pickers", data.pickers).length
    };
  }

  return {
    champs: applyClientFilters(
      filterItems(keepUsersSectionItems("champs", data.champs), query),
      filters
    ).length,
    management: applyClientFilters(
      filterItems(
        keepUsersSectionItems("management", data.management),
        query
      ),
      filters
    ).length,
    pickers: applyClientFilters(
      filterItems(keepUsersSectionItems("pickers", data.pickers), query),
      filters
    ).length
  };
}

function filterItems(items: UsersAreaItem[], query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return items;
  }

  return items.filter((item) =>
    [
      item.user.nameEn,
      item.user.nameAr,
      item.user.phoneNumber,
      getUserIdentifier(item.user),
      item.vendor?.vendorName,
      item.vendor?.vendorCode,
      item.chain?.chainName,
      item.chain?.chainCode,
      item.champ?.nameEn,
      item.areaManager?.nameEn
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalized))
  );
}

function applyClientFilters(items: UsersAreaItem[], filters: DirectoryFilters) {
  return items.filter((item) => {
    if (filters.chainId && item.chain?.id !== filters.chainId) {
      return false;
    }

    if (filters.vendorId && item.vendor?.id !== filters.vendorId) {
      return false;
    }

    if (
      filters.areaManagerId &&
      item.user.id !== filters.areaManagerId &&
      item.areaManager?.id !== filters.areaManagerId
    ) {
      return false;
    }

    if (
      filters.champId &&
      item.user.id !== filters.champId &&
      item.champ?.id !== filters.champId
    ) {
      return false;
    }

    if (filters.status && item.user.accountStatus !== filters.status) {
      return false;
    }

    return true;
  });
}

function emptyUsersAreaData(): UsersAreaData {
  return {
    champs: [],
    filters: emptyFilterOptions(),
    management: [],
    meta: {},
    pickers: []
  };
}

function emptyFilterOptions(): UsersFilterOptions {
  return {
    areaManagers: [],
    chains: [],
    champs: [],
    vendors: []
  };
}

function toApiFilters(filters: DirectoryFilters): Pick<
  ListUsersParams,
  "areaManagerId" | "chainId" | "champId" | "status" | "vendorId"
> {
  return {
    areaManagerId: filters.areaManagerId || undefined,
    chainId: filters.chainId || undefined,
    champId: filters.champId || undefined,
    status: filters.status || undefined,
    vendorId: filters.vendorId || undefined
  };
}

function filterOptionsFromScopedItems(items: UsersAreaItem[]): UsersFilterOptions {
  return {
    areaManagers: uniqueOptions(
      items
        .filter((item) => item.areaManager)
        .map((item) => ({
          hint: item.areaManager!.phoneNumber,
          id: item.areaManager!.id,
          label: item.areaManager!.nameEn
        }))
    ),
    chains: uniqueOptions(
      items
        .filter((item) => item.chain)
        .map((item) => ({
          hint: item.chain!.chainCode,
          id: item.chain!.id,
          label: item.chain!.chainName
        }))
    ),
    champs: uniqueOptions(
      items
        .filter((item) => item.champ)
        .map((item) => ({
          hint: item.champ!.phoneNumber,
          id: item.champ!.id,
          label: item.champ!.nameEn
        }))
    ),
    vendors: uniqueOptions(
      items
        .filter((item) => item.vendor)
        .map((item) => ({
          hint: item.vendor!.vendorCode,
          id: item.vendor!.id,
          label: item.vendor!.vendorName
        }))
    )
  };
}

function filterOptionsFromAdminOrganization(
  chains: Array<{
    id: string;
    chainCode: string;
    chainName: string;
    currentAreaManager: UserSummary | null;
    branches: Array<{
      id: string;
      vendorCode: string;
      vendorName: string;
      currentChamp: UserSummary | null;
    }>;
  }>
): UsersFilterOptions {
  const branches = chains.flatMap((chain) => chain.branches);

  return {
    areaManagers: uniqueOptions(
      chains
        .filter((chain) => chain.currentAreaManager)
        .map((chain) => ({
          hint: chain.currentAreaManager!.phoneNumber,
          id: chain.currentAreaManager!.id,
          label: chain.currentAreaManager!.nameEn
        }))
    ),
    chains: chains.map((chain) => ({
      hint: chain.chainCode,
      id: chain.id,
      label: chain.chainName
    })),
    champs: uniqueOptions(
      branches
        .filter((branch) => branch.currentChamp)
        .map((branch) => ({
          hint: branch.currentChamp!.phoneNumber,
          id: branch.currentChamp!.id,
          label: branch.currentChamp!.nameEn
        }))
    ),
    vendors: branches.map((branch) => ({
      hint: branch.vendorCode,
      id: branch.id,
      label: branch.vendorName
    }))
  };
}

function uniqueOptions(options: FilterOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) {
      return false;
    }
    seen.add(option.id);
    return true;
  });
}

function toInitialTransferPicker(item: UsersAreaItem): InitialTransferPicker {
  const activeAssignment =
    item.assignment?.status === "ACTIVE" ? item.assignment : null;

  return {
    assignment: activeAssignment,
    chain: activeAssignment ? item.chain ?? null : null,
    user: {
      id: item.user.id,
      nameEn: item.user.nameEn,
      phoneNumber: item.user.phoneNumber,
      role: item.user.role
    },
    vendor: activeAssignment ? item.vendor ?? null : null
  };
}

function toUsersAreaItemFromProfile(
  profile: OperationalProfileResponse
): UsersAreaItem {
  return {
    assignment: profile.currentPickerAssignment,
    chain: profile.currentPickerAssignment?.chain ?? null,
    key: profile.currentPickerAssignment?.id ?? profile.user.id,
    pendingRequest: null,
    user: profile.user,
    vendor: profile.currentPickerAssignment?.vendor ?? null
  };
}

function toUserSummaryFromSafeUser(user: SafeUser): UserSummary {
  return {
    accountStatus: user.accountStatus,
    employmentStatus: user.employmentStatus,
    id: user.id,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    phoneNumber: user.phoneNumber,
    profileStatus: user.profileStatus,
    role: user.role
  };
}

function getOperationalContextDisplay(item: UsersAreaItem) {
  if (item.user.role === "AREA_MANAGER") {
    return {
      meta: item.assignment?.startDate
        ? `Since ${formatDate(item.assignment.startDate)}`
        : "Assignment date unavailable",
      primary: item.chain?.chainName ?? "Chain scope",
      secondary: item.chain?.chainCode ?? "Area management"
    };
  }

  if (item.user.role === "ADMIN" || item.user.role === "SUPER_ADMIN") {
    return {
      meta: "No assignment source required",
      primary: "System operations",
      secondary: "Management scope"
    };
  }

  return {
    meta: item.assignment?.startDate
      ? `Since ${formatDate(item.assignment.startDate)}`
      : "Assignment date unavailable",
    primary: item.vendor?.vendorName ?? "Not assigned",
    secondary: getItemChainName(item) || "No Chain assigned"
  };
}

function getManagerDisplay(item: UsersAreaItem) {
  if (item.user.role === "PICKER") {
    return item.champ
      ? { name: item.champ.nameEn, role: "Champ" }
      : { name: "Not assigned", role: "Champ" };
  }

  if (item.user.role === "CHAMP") {
    return item.areaManager
      ? { name: item.areaManager.nameEn, role: "Area Manager" }
      : { name: "Chain scope", role: "Area Manager" };
  }

  if (item.user.role === "AREA_MANAGER") {
    return { name: "Chain scope", role: "Management" };
  }

  return { name: "System owner", role: "Admin scope" };
}

function getLifecycleDisplay(item: UsersAreaItem) {
  const operationalStatus = getUserOperationalStatus(item);

  if (item.pendingRequest) {
    return {
      label: "Pending request",
      title: `${formatEnum(item.pendingRequest.type)} request in progress`,
      tone: "pending" as const
    };
  }

  if (item.user.accountStatus === "ARCHIVED") {
    return {
      label: "Archived",
      title: "User account is archived",
      tone: "muted" as const
    };
  }

  if (
    item.user.employmentStatus === "RESIGNED" ||
    item.user.employmentStatus === "ARCHIVED"
  ) {
    return {
      label: "Resigned",
      title: "Resignation confirmed",
      tone: "blocked" as const
    };
  }

  if (
    item.user.accountStatus === "SUSPENDED" ||
    ("blockStatus" in item.user && item.user.blockStatus !== "NO_BLOCK")
  ) {
    return {
      label: "Blocked",
      title: "User is blocked or suspended",
      tone: "blocked" as const
    };
  }

  if (item.user.profileStatus !== "COMPLETE") {
    return {
      label: "Profile incomplete",
      title: "Profile still requires completion or review",
      tone: "pending" as const
    };
  }

  return {
    label: operationalStatus.label,
    title: operationalStatus.title,
    tone: operationalStatus.tone === "active" ? "active" : "pending"
  };
}

function getUserIdentifier(user: SafeUser | UserSummary) {
  if ("shopperId" in user && user.shopperId) {
    return `Shopper ID ${user.shopperId}`;
  }

  if ("ibsId" in user && user.ibsId) {
    return `IBS ID ${user.ibsId}`;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return `Admin ID ${user.id.slice(0, 8)}`;
  }

  return user.phoneNumber;
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getActiveFilterEntries(filters: DirectoryFilters) {
  return (Object.entries(filters) as Array<[DirectoryFilterKey, string]>).filter(
    ([, value]) => Boolean(value)
  );
}

function hasActiveFilters(filters: DirectoryFilters) {
  return getActiveFilterEntries(filters).length > 0;
}

function getFilterName(key: DirectoryFilterKey) {
  if (key === "chainId") return "Chain";
  if (key === "vendorId") return "Branch";
  if (key === "areaManagerId") return "Area Manager";
  if (key === "champId") return "Champ";
  return "Status";
}

function getFilterLabel(
  key: DirectoryFilterKey,
  value: string,
  options: UsersFilterOptions
) {
  if (key === "status") {
    return statusOptions.find((option) => option.value === value)?.label ?? value;
  }

  const source =
    key === "chainId"
      ? options.chains
      : key === "vendorId"
        ? options.vendors
        : key === "areaManagerId"
          ? options.areaManagers
          : options.champs;

  return source.find((option) => option.id === value)?.label ?? value;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function getPageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from(
    { length: end - adjustedStart + 1 },
    (_, index) => adjustedStart + index
  );
}
