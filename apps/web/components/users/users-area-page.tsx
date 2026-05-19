"use client";

import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  Rows3,
  Search,
  UserMinus,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
import type { PageMeta } from "@/lib/api/organization";
import type { ResignationTargetRole } from "@/lib/api/requests";
import { usersApi, type OperationalProfileResponse } from "@/lib/api/users";
import {
  type AssignmentSummary,
  type ChainSummary,
  type UserSummary,
  type VendorSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { OperationalUserProfileModal } from "./operational-user-profile-modal";

type UsersSectionId = "pickers" | "champs" | "management";
type ViewMode = "cards" | "rows";
type UsersFilterKey = "chainId" | "vendorId" | "areaManagerId" | "champId";

type UsersAreaState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: UsersAreaData; error?: never };

type UsersAreaData = {
  pickers: UsersAreaItem[];
  champs: UsersAreaItem[];
  management: UsersAreaItem[];
  meta: Partial<Record<UsersSectionId, PageMeta>>;
  filters: UsersFilterOptions;
};

type UsersAreaItem = {
  key: string;
  user: UserSummary | SafeUser;
  assignment?: AssignmentSummary | null;
  vendor?: VendorSummary | null;
  chain?: ChainSummary | null;
  champ?: UserSummary | null;
};

type UsersFilters = Record<UsersFilterKey, string>;
type FilterOption = { id: string; label: string; hint?: string };
type UsersFilterOptions = {
  chains: FilterOption[];
  vendors: FilterOption[];
  areaManagers: FilterOption[];
  champs: FilterOption[];
};

const PAGE_SIZE = 20;
const managementRoles: UserRole[] = ["AREA_MANAGER", "ADMIN", "SUPER_ADMIN"];
const emptyFilters: UsersFilters = {
  chainId: "",
  vendorId: "",
  areaManagerId: "",
  champId: ""
};
const initialPages: Record<UsersSectionId, number> = {
  pickers: 1,
  champs: 1,
  management: 1
};

export function UsersAreaPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersAreaState>({ status: "loading" });
  const [activeSection, setActiveSection] = useState<UsersSectionId>("pickers");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<UsersFilters>(emptyFilters);
  const [pageBySection, setPageBySection] =
    useState<Record<UsersSectionId, number>>(initialPages);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState<NewRequestDraft | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const viewerIsAdmin = isAdminRole(user?.role);

  async function loadUsersArea() {
    if (!user) {
      return;
    }

    setState({ status: "loading" });
    setRequestError(null);
    try {
      setState({
        status: "ready",
        data: await fetchUsersAreaData(user.role, {
          filters,
          pageBySection,
          query: debouncedQuery
        })
      });
    } catch (caughtError) {
      setState({
        status: "error",
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Users area."
      });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void loadUsersArea();
  }, [
    user?.role,
    debouncedQuery,
    filters.chainId,
    filters.vendorId,
    filters.areaManagerId,
    filters.champId,
    pageBySection.pickers,
    pageBySection.champs,
    pageBySection.management
  ]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [searchParams]);

  const visibleSections = useMemo(
    () => getVisibleSections(user?.role),
    [user?.role]
  );
  const data = state.status === "ready" ? state.data : emptyUsersAreaData();

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? "pickers");
    }
  }, [activeSection, visibleSections]);

  const activeSectionLabel =
    visibleSections.find((section) => section.id === activeSection)?.label ??
    getSectionLabel(activeSection, user?.role);
  const currentPage = pageBySection[activeSection];
  const activeResult = getActiveSectionResult({
    data,
    filters,
    isServerDriven: viewerIsAdmin,
    page: currentPage,
    query: debouncedQuery,
    section: activeSection
  });
  const selectedItem =
    [...data.pickers, ...data.champs, ...data.management].find(
      (item) => item.user.id === selectedUserId
    ) ?? null;
  const selectedUser = selectedItem?.user ?? null;
  const allowedResignationRoles = getAllowedResignationTargetRoles(user?.role);
  const showAdvancedFilters =
    user?.role === "AREA_MANAGER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  function resetPages() {
    setPageBySection(initialPages);
  }

  function updateFilter(key: UsersFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    resetPages();
  }

  function clearFilter(key: UsersFilterKey) {
    updateFilter(key, "");
  }

  function clearAllFilters() {
    setFilters(emptyFilters);
    resetPages();
  }

  function selectSection(section: UsersSectionId) {
    setActiveSection(section);
    setPageBySection((current) => ({ ...current, [section]: 1 }));
    setOpenActionMenu(null);
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
      type: "RESIGNATION",
      targetRole: target.role,
      initialUser: {
        id: target.id,
        nameEn: target.nameEn,
        phoneNumber: target.phoneNumber,
        role: target.role
      }
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
        "This Picker has multiple active Branch assignments in the current view. Resolve the assignment data before starting Transfer."
      );
      return;
    }

    let transferTarget =
      target.assignment || activeAssignments[0]?.assignment
        ? target.assignment
          ? target
          : activeAssignments[0]
        : target;

    if (!transferTarget.assignment) {
      try {
        transferTarget = toUsersAreaItemFromProfile(
          await usersApi.operationalProfile(target.user.id)
        );
      } catch {
        transferTarget = target;
      }
    }

    setRequestDraft({
      type: "TRANSFER",
      initialPicker: toInitialTransferPicker(transferTarget)
    });
  }

  function openTransferFromProfile(profile: OperationalProfileResponse) {
    void openTransfer(toUsersAreaItemFromProfile(profile));
  }

  function handleCreated() {
    setRequestDraft(null);
    void loadUsersArea();
  }

  return (
    <div className="grid gap-4">
      <RoleTabs
        activeSection={activeSection}
        counts={getSectionCounts(data, filters, debouncedQuery, viewerIsAdmin)}
        onSelect={selectSection}
        sections={visibleSections}
      />

      <section className="grid gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 lg:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-2xl border-slate-200 bg-white pl-9 shadow-sm"
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search name, phone, Branch, Chain"
              value={query}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {showAdvancedFilters ? (
              <Button
                aria-expanded={filtersOpen}
                className={cn(
                  "h-11 rounded-2xl border-slate-200 bg-white px-3 shadow-sm",
                  hasActiveFilters(filters) &&
                    "border-orange-200 bg-orange-50 text-orange-700"
                )}
                onClick={() => setFiltersOpen((current) => !current)}
                type="button"
                variant="outline"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters(filters) ? (
                  <span className="ml-2 rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {activeFilterCount(filters)}
                  </span>
                ) : null}
              </Button>
            ) : null}

            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {showAdvancedFilters && filtersOpen ? (
          <UsersFilterPanel
            filters={filters}
            onChange={updateFilter}
            onClearAll={clearAllFilters}
            options={data.filters}
            viewerRole={user?.role}
          />
        ) : null}

        <ActiveFilterChips
          filters={filters}
          onClear={clearFilter}
          options={data.filters}
        />
      </section>

      {requestError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      ) : null}

      {state.status === "loading" ? (
        <TableRowsSkeleton label="Loading Users" rows={6} />
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      ) : (
        <>
          <UsersSection
            activeMenuKey={openActionMenu}
            items={activeResult.items}
            onOpenProfile={setSelectedUserId}
            onOpenResignation={openResignation}
            onOpenTransfer={(item) => void openTransfer(item)}
            onToggleMenu={(key) =>
              setOpenActionMenu((current) => (current === key ? null : key))
            }
            sectionLabel={activeSectionLabel}
            viewMode={viewMode}
            viewerRole={user?.role}
          />
          <PaginationControls
            label={activeSectionLabel}
            onNext={() =>
              setPageBySection((current) => ({
                ...current,
                [activeSection]: Math.min(
                  activeResult.totalPages,
                  current[activeSection] + 1
                )
              }))
            }
            onPrevious={() =>
              setPageBySection((current) => ({
                ...current,
                [activeSection]: Math.max(1, current[activeSection] - 1)
              }))
            }
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={activeResult.total}
            totalPages={activeResult.totalPages}
          />
        </>
      )}

      {selectedUserId ? (
        <OperationalUserProfileModal
          actions={{
            onTransfer:
              selectedItem?.user.role === "PICKER" || !selectedItem
                ? (_user, profile) => {
                    if (profile) {
                      openTransferFromProfile(profile);
                    } else if (selectedItem) {
                      void openTransfer(selectedItem);
                    }
                  }
                : undefined,
            onResignation:
              selectedUser &&
              isResignationTargetRole(selectedUser.role) &&
              allowedResignationRoles.includes(selectedUser.role)
                ? () => openResignation(selectedUser)
                : undefined
          }}
          onClose={() => setSelectedUserId(null)}
          onUpdated={() => void loadUsersArea()}
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
    </div>
  );
}

function RoleTabs({
  activeSection,
  counts,
  onSelect,
  sections
}: {
  activeSection: UsersSectionId;
  counts: Record<UsersSectionId, number>;
  onSelect: (section: UsersSectionId) => void;
  sections: Array<{ id: UsersSectionId; label: string }>;
}) {
  if (!sections.length) {
    return null;
  }

  return (
    <div
      aria-label="User role sections"
      className={cn(
        "grid gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm",
        sections.length === 1 && "grid-cols-1",
        sections.length === 2 && "grid-cols-2",
        sections.length === 3 && "grid-cols-3"
      )}
      role="tablist"
    >
      {sections.map((section) => (
        <button
          aria-selected={activeSection === section.id}
          className={cn(
            "min-h-11 min-w-0 rounded-xl px-2 py-2 text-center text-xs font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:text-sm",
            activeSection === section.id
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          )}
          key={section.id}
          onClick={() => onSelect(section.id)}
          role="tab"
          type="button"
        >
          <span className="block">{section.label}</span>
          <span
            className={cn(
              "mt-0.5 block text-[11px] font-medium",
              activeSection === section.id ? "text-slate-200" : "text-slate-400"
            )}
          >
            {counts[section.id]}
          </span>
        </button>
      ))}
    </div>
  );
}

function ViewModeToggle({
  onChange,
  value
}: {
  onChange: (value: ViewMode) => void;
  value: ViewMode;
}) {
  return (
    <div className="grid h-11 grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        aria-label="Cards view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
          value === "cards" ? "bg-orange-50 text-orange-700" : "text-slate-500"
        )}
        onClick={() => onChange("cards")}
        type="button"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        aria-label="Rows view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
          value === "rows" ? "bg-orange-50 text-orange-700" : "text-slate-500"
        )}
        onClick={() => onChange("rows")}
        type="button"
      >
        <Rows3 className="h-4 w-4" />
      </button>
    </div>
  );
}

function UsersFilterPanel({
  filters,
  onChange,
  onClearAll,
  options,
  viewerRole
}: {
  filters: UsersFilters;
  onChange: (key: UsersFilterKey, value: string) => void;
  onClearAll: () => void;
  options: UsersFilterOptions;
  viewerRole?: UserRole;
}) {
  const admin = isAdminRole(viewerRole);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Chain"
          onChange={(value) => onChange("chainId", value)}
          options={options.chains}
          value={filters.chainId}
        />
        <FilterSelect
          label="Branch"
          onChange={(value) => onChange("vendorId", value)}
          options={options.vendors}
          value={filters.vendorId}
        />
        {admin ? (
          <FilterSelect
            label="Area Manager"
            onChange={(value) => onChange("areaManagerId", value)}
            options={options.areaManagers}
            value={filters.areaManagerId}
          />
        ) : null}
        <FilterSelect
          label="Champ"
          onChange={(value) => onChange("champId", value)}
          options={options.champs}
          value={filters.champId}
        />
      </div>
      {hasActiveFilters(filters) ? (
        <Button
          className="mt-3 h-10 rounded-xl"
          onClick={onClearAll}
          type="button"
          variant="outline"
        >
          <X className="mr-2 h-4 w-4" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
      {label}
      <Select
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
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

function ActiveFilterChips({
  filters,
  onClear,
  options
}: {
  filters: UsersFilters;
  onClear: (key: UsersFilterKey) => void;
  options: UsersFilterOptions;
}) {
  const active = (Object.entries(filters) as Array<[UsersFilterKey, string]>).filter(
    ([, value]) => Boolean(value)
  );

  if (!active.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([key, value]) => (
        <button
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 text-xs font-semibold text-orange-800 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          key={key}
          onClick={() => onClear(key)}
          type="button"
        >
          {getFilterName(key)}: {getFilterLabel(key, value, options)}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function UsersSection({
  activeMenuKey,
  items,
  onOpenProfile,
  onOpenResignation,
  onOpenTransfer,
  onToggleMenu,
  sectionLabel,
  viewMode,
  viewerRole
}: {
  activeMenuKey: string | null;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  onOpenResignation: (user: UserSummary | SafeUser) => void;
  onOpenTransfer: (item: UsersAreaItem) => void;
  onToggleMenu: (key: string) => void;
  sectionLabel: string;
  viewMode: ViewMode;
  viewerRole?: UserRole;
}) {
  if (!items.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <Users className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">
          No {sectionLabel.toLowerCase()} are currently visible.
        </p>
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
          Users appear here when assignment data puts them inside your scope.
        </p>
      </div>
    );
  }

  if (viewMode === "rows") {
    return (
      <section className="grid gap-2">
        {items.map((item) => (
          <UserRow
            activeMenuKey={activeMenuKey}
            item={item}
            key={item.key}
            onOpenProfile={onOpenProfile}
            onOpenResignation={onOpenResignation}
            onOpenTransfer={onOpenTransfer}
            onToggleMenu={onToggleMenu}
            viewerRole={viewerRole}
          />
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <UserCard
          activeMenuKey={activeMenuKey}
          item={item}
          key={item.key}
          onOpenProfile={onOpenProfile}
          onOpenResignation={onOpenResignation}
          onOpenTransfer={onOpenTransfer}
          onToggleMenu={onToggleMenu}
          viewerRole={viewerRole}
        />
      ))}
    </section>
  );
}

function UserCard({
  activeMenuKey,
  item,
  onOpenProfile,
  onOpenResignation,
  onOpenTransfer,
  onToggleMenu,
  viewerRole
}: UserItemProps) {
  return (
    <article
      className="group grid cursor-pointer gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      onClick={() => onOpenProfile(item.user.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenProfile(item.user.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <UserIdentity item={item} />
        <UserQuickActions
          activeMenuKey={activeMenuKey}
          item={item}
          onOpenResignation={onOpenResignation}
          onOpenTransfer={onOpenTransfer}
          onToggleMenu={onToggleMenu}
          viewerRole={viewerRole}
        />
      </div>

      <AssignmentContext item={item} />
    </article>
  );
}

function UserRow({
  activeMenuKey,
  item,
  onOpenProfile,
  onOpenResignation,
  onOpenTransfer,
  onToggleMenu,
  viewerRole
}: UserItemProps) {
  return (
    <article
      className="grid cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto] sm:items-center"
      onClick={() => onOpenProfile(item.user.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenProfile(item.user.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <UserIdentity compact item={item} />
      <AssignmentContext compact item={item} />
      <div className="justify-self-end">
        <UserQuickActions
          activeMenuKey={activeMenuKey}
          item={item}
          onOpenResignation={onOpenResignation}
          onOpenTransfer={onOpenTransfer}
          onToggleMenu={onToggleMenu}
          viewerRole={viewerRole}
        />
      </div>
    </article>
  );
}

type UserItemProps = {
  activeMenuKey: string | null;
  item: UsersAreaItem;
  onOpenProfile: (id: string) => void;
  onOpenResignation: (user: UserSummary | SafeUser) => void;
  onOpenTransfer: (item: UsersAreaItem) => void;
  onToggleMenu: (key: string) => void;
  viewerRole?: UserRole;
};

function UserIdentity({
  compact,
  item
}: {
  compact?: boolean;
  item: UsersAreaItem;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white",
          compact ? "h-10 w-10" : "h-11 w-11"
        )}
      >
        {getInitials(item.user.nameEn) || <UserRound className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">
          {item.user.nameEn}
        </p>
        <p className="truncate text-xs text-slate-500">{item.user.phoneNumber}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
            {formatEnum(item.user.role)}
          </Badge>
          <Badge variant="muted">{formatEnum(item.user.employmentStatus)}</Badge>
        </div>
      </div>
    </div>
  );
}

function AssignmentContext({
  compact,
  item
}: {
  compact?: boolean;
  item: UsersAreaItem;
}) {
  if (!item.vendor && !item.chain) {
    return (
      <div
        className={cn(
          "rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500",
          compact && "sm:text-right"
        )}
      >
        Assignment context opens in profile.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600",
        compact && "sm:text-right"
      )}
    >
      {item.vendor ? (
        <p className="truncate">
          <span className="font-semibold text-slate-900">Branch:</span>{" "}
          {item.vendor.vendorName}
        </p>
      ) : null}
      {item.chain ? (
        <p className="truncate">
          <span className="font-semibold text-slate-900">Chain:</span>{" "}
          {item.chain.chainName}
        </p>
      ) : null}
    </div>
  );
}

function UserQuickActions({
  activeMenuKey,
  item,
  onOpenResignation,
  onOpenTransfer,
  onToggleMenu,
  viewerRole
}: {
  activeMenuKey: string | null;
  item: UsersAreaItem;
  onOpenResignation: (user: UserSummary | SafeUser) => void;
  onOpenTransfer: (item: UsersAreaItem) => void;
  onToggleMenu: (key: string) => void;
  viewerRole?: UserRole;
}) {
  const allowedResignationRoles = getAllowedResignationTargetRoles(viewerRole);
  const canTransfer = item.user.role === "PICKER";
  const canResign =
    isResignationTargetRole(item.user.role) &&
    allowedResignationRoles.includes(item.user.role);
  const menuOpen = activeMenuKey === item.key;

  if (!canTransfer && !canResign) {
    return null;
  }

  return (
    <div
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        aria-expanded={menuOpen}
        aria-label={`Open actions for ${item.user.nameEn}`}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        onClick={() => onToggleMenu(item.key)}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
          {canTransfer ? (
            <MenuAction
              icon={<ArrowRightLeft className="h-4 w-4" />}
              label="Transfer"
              onClick={() => onOpenTransfer(item)}
              tone="blue"
            />
          ) : null}
          {canResign ? (
            <MenuAction
              icon={<UserMinus className="h-4 w-4" />}
              label="Resign"
              onClick={() => onOpenResignation(item.user)}
              tone="red"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  tone
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "blue" | "red";
}) {
  return (
    <button
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        tone === "blue" && "text-blue-700 hover:bg-blue-50",
        tone === "red" && "text-red-700 hover:bg-red-50"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function PaginationControls({
  label,
  onNext,
  onPrevious,
  page,
  pageSize,
  total,
  totalPages
}: {
  label: string;
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  if (total <= pageSize && page === 1) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-xs font-medium text-slate-500 sm:text-left">
        {label}: page {page} of {totalPages} · {total} total
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          className="h-10 rounded-xl"
          disabled={page <= 1}
          onClick={onPrevious}
          type="button"
          variant="outline"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          className="h-10 rounded-xl"
          disabled={page >= totalPages}
          onClick={onNext}
          type="button"
          variant="outline"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

async function fetchUsersAreaData(
  role: UserRole,
  params: {
    filters: UsersFilters;
    pageBySection: Record<UsersSectionId, number>;
    query: string;
  }
): Promise<UsersAreaData> {
  if (role === "CHAMP") {
    const workspace = await workspacesApi.champBranches();
    return {
      pickers: workspace.branches.flatMap((branch) =>
        branch.pickers.map((picker) => ({
          key: picker.assignment.id,
          user: picker.picker,
          assignment: picker.assignment,
          vendor: branch.vendor,
          chain: branch.chain
        }))
      ),
      champs: [],
      management: [],
      meta: {},
      filters: emptyFilterOptions()
    };
  }

  if (role === "AREA_MANAGER") {
    const workspace = await workspacesApi.areaManager();
    const pickers = workspace.chains.flatMap((chain) =>
      chain.vendors.flatMap((vendor) =>
        vendor.pickers.map((picker) => ({
          key: picker.assignment.id,
          user: picker.picker,
          assignment: picker.assignment,
          vendor: vendor.vendor,
          chain: chain.chain,
          champ: vendor.champs[0]?.champ ?? null
        }))
      )
    );
    const champs = workspace.chains.flatMap((chain) =>
      chain.vendors.flatMap((vendor) =>
        vendor.champs.map((champ) => ({
          key: champ.assignment.id,
          user: champ.champ,
          assignment: champ.assignment,
          vendor: vendor.vendor,
          chain: chain.chain,
          champ: champ.champ
        }))
      )
    );

    return {
      pickers,
      champs,
      management: [],
      meta: {},
      filters: filterOptionsFromScopedItems([...pickers, ...champs])
    };
  }

  if (isAdminRole(role)) {
    const apiFilters = toApiFilters(params.filters);
    const [pickers, champs, management, organization] = await Promise.all([
      usersApi.list({
        page: params.pageBySection.pickers,
        pageSize: PAGE_SIZE,
        role: "PICKER",
        q: params.query,
        ...apiFilters
      }),
      usersApi.list({
        page: params.pageBySection.champs,
        pageSize: PAGE_SIZE,
        role: "CHAMP",
        q: params.query,
        ...apiFilters
      }),
      usersApi.list({
        page: params.pageBySection.management,
        pageSize: PAGE_SIZE,
        roles: managementRoles,
        q: params.query,
        ...apiFilters
      }),
      adminOrganizationApi.get()
    ]);

    return {
      pickers: pickers.items.map((item) => ({ key: item.id, user: item })),
      champs: champs.items.map((item) => ({ key: item.id, user: item })),
      management: management.items.map((item) => ({ key: item.id, user: item })),
      meta: {
        pickers: pickers.meta,
        champs: champs.meta,
        management: management.meta
      },
      filters: filterOptionsFromAdminOrganization(organization.chains)
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
  filters: UsersFilters;
  isServerDriven: boolean;
  page: number;
  query: string;
  section: UsersSectionId;
}) {
  if (isServerDriven) {
    const meta = data.meta[section];
    return {
      items: data[section],
      total: meta?.total ?? data[section].length,
      totalPages: meta?.totalPages ?? 1
    };
  }

  const filtered = applyClientFilters(filterItems(data[section], query), filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return {
    items: filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    total: filtered.length,
    totalPages
  };
}

function getSectionCounts(
  data: UsersAreaData,
  filters: UsersFilters,
  query: string,
  serverDriven: boolean
): Record<UsersSectionId, number> {
  if (serverDriven) {
    return {
      pickers: data.meta.pickers?.total ?? data.pickers.length,
      champs: data.meta.champs?.total ?? data.champs.length,
      management: data.meta.management?.total ?? data.management.length
    };
  }

  return {
    pickers: applyClientFilters(filterItems(data.pickers, query), filters).length,
    champs: applyClientFilters(filterItems(data.champs, query), filters).length,
    management: applyClientFilters(filterItems(data.management, query), filters)
      .length
  };
}

function getVisibleSections(role: UserRole | undefined) {
  if (role === "CHAMP") {
    return [{ id: "pickers" as const, label: "My Pickers" }];
  }
  if (role === "AREA_MANAGER") {
    return [
      { id: "pickers" as const, label: "My Pickers" },
      { id: "champs" as const, label: "My Champs" }
    ];
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return [
      { id: "pickers" as const, label: "All Pickers" },
      { id: "champs" as const, label: "All Champs" },
      { id: "management" as const, label: "Management Users" }
    ];
  }
  return [];
}

function getAllowedResignationTargetRoles(
  role: UserRole | undefined
): ResignationTargetRole[] {
  if (role === "CHAMP") return ["PICKER"];
  if (role === "AREA_MANAGER") return ["PICKER", "CHAMP"];
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

function isResignationTargetRole(role: UserRole): role is ResignationTargetRole {
  return role === "PICKER" || role === "CHAMP" || role === "AREA_MANAGER";
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
      item.vendor?.vendorName,
      item.vendor?.vendorCode,
      item.chain?.chainName,
      item.chain?.chainCode,
      item.champ?.nameEn
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalized))
  );
}

function applyClientFilters(items: UsersAreaItem[], filters: UsersFilters) {
  return items.filter((item) => {
    if (filters.chainId && item.chain?.id !== filters.chainId) {
      return false;
    }
    if (filters.vendorId && item.vendor?.id !== filters.vendorId) {
      return false;
    }
    if (
      filters.champId &&
      item.user.id !== filters.champId &&
      item.champ?.id !== filters.champId
    ) {
      return false;
    }
    return true;
  });
}

function emptyUsersAreaData(): UsersAreaData {
  return {
    pickers: [],
    champs: [],
    management: [],
    meta: {},
    filters: emptyFilterOptions()
  };
}

function emptyFilterOptions(): UsersFilterOptions {
  return { chains: [], vendors: [], areaManagers: [], champs: [] };
}

function getSectionLabel(sectionId: UsersSectionId, role?: UserRole) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    if (sectionId === "pickers") return "All Pickers";
    if (sectionId === "champs") return "All Champs";
  }
  if (sectionId === "pickers") return "My Pickers";
  if (sectionId === "champs") return "My Champs";
  return "Management Users";
}

function toInitialTransferPicker(item: UsersAreaItem): InitialTransferPicker {
  return {
    user: {
      id: item.user.id,
      nameEn: item.user.nameEn,
      phoneNumber: item.user.phoneNumber,
      role: item.user.role
    },
    assignment: item.assignment ?? null,
    vendor: item.vendor ?? null,
    chain: item.chain ?? null
  };
}

function toUsersAreaItemFromProfile(
  profile: OperationalProfileResponse
): UsersAreaItem {
  return {
    key: profile.currentPickerAssignment?.id ?? profile.user.id,
    user: profile.user,
    assignment: profile.currentPickerAssignment,
    vendor: profile.currentPickerAssignment?.vendor ?? null,
    chain: profile.currentPickerAssignment?.chain ?? null
  };
}

function toApiFilters(filters: UsersFilters) {
  return {
    chainId: filters.chainId || undefined,
    vendorId: filters.vendorId || undefined,
    areaManagerId: filters.areaManagerId || undefined,
    champId: filters.champId || undefined
  };
}

function filterOptionsFromScopedItems(items: UsersAreaItem[]): UsersFilterOptions {
  return {
    chains: uniqueOptions(
      items
        .filter((item) => item.chain)
        .map((item) => ({
          id: item.chain!.id,
          label: item.chain!.chainName,
          hint: item.chain!.chainCode
        }))
    ),
    vendors: uniqueOptions(
      items
        .filter((item) => item.vendor)
        .map((item) => ({
          id: item.vendor!.id,
          label: item.vendor!.vendorName,
          hint: item.vendor!.vendorCode
        }))
    ),
    areaManagers: [],
    champs: uniqueOptions(
      items
        .filter((item) => item.champ)
        .map((item) => ({
          id: item.champ!.id,
          label: item.champ!.nameEn,
          hint: item.champ!.phoneNumber
        }))
    )
  };
}

function filterOptionsFromAdminOrganization(
  chains: Array<{
    id: string;
    chainName: string;
    chainCode: string;
    currentAreaManager: UserSummary | null;
    branches: Array<{
      id: string;
      vendorName: string;
      vendorCode: string;
      currentChamp: UserSummary | null;
    }>;
  }>
): UsersFilterOptions {
  const branches = chains.flatMap((chain) => chain.branches);

  return {
    chains: chains.map((chain) => ({
      id: chain.id,
      label: chain.chainName,
      hint: chain.chainCode
    })),
    vendors: branches.map((branch) => ({
      id: branch.id,
      label: branch.vendorName,
      hint: branch.vendorCode
    })),
    areaManagers: uniqueOptions(
      chains
        .filter((chain) => chain.currentAreaManager)
        .map((chain) => ({
          id: chain.currentAreaManager!.id,
          label: chain.currentAreaManager!.nameEn,
          hint: chain.currentAreaManager!.phoneNumber
        }))
    ),
    champs: uniqueOptions(
      branches
        .filter((branch) => branch.currentChamp)
        .map((branch) => ({
          id: branch.currentChamp!.id,
          label: branch.currentChamp!.nameEn,
          hint: branch.currentChamp!.phoneNumber
        }))
    )
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

function hasActiveFilters(filters: UsersFilters) {
  return activeFilterCount(filters) > 0;
}

function activeFilterCount(filters: UsersFilters) {
  return Object.values(filters).filter(Boolean).length;
}

function getFilterName(key: UsersFilterKey) {
  if (key === "chainId") return "Chain";
  if (key === "vendorId") return "Branch";
  if (key === "areaManagerId") return "Area Manager";
  return "Champ";
}

function getFilterLabel(
  key: UsersFilterKey,
  value: string,
  options: UsersFilterOptions
) {
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

function isAdminRole(role: UserRole | undefined): role is "ADMIN" | "SUPER_ADMIN" {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
