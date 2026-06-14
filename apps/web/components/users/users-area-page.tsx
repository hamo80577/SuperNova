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
  type UserLookupStatus,
  type WorkforceSummaryParams,
  type WorkforceSummaryResponse
} from "@/lib/api/users";
import { type UserSummary, workspacesApi } from "@/lib/api/workspaces";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { OperationalUserProfileModal } from "./operational-user-profile-modal";
import { UserAvatar } from "./user-avatar";
import {
  getAllowedDeductionTargetRoles,
  getAllowedResignationTargetRoles,
  isDeductionTargetRole,
  isResignationTargetRole,
  UsersActionsMenu,
  type UsersActionHandlers
} from "./users-actions-menu";
import {
  canLoadWorkforceSummary,
  deriveVisibleFilterOptions,
  formatWorkforceSummaryMetric,
  getUsersSectionLabel,
  getScopedWorkforceSummaryRole,
  getVisibleUserSections,
  isAdminUsersRole,
  keepUsersSectionItems,
  sanitizeFiltersForOptions,
  type WorkforceKpiMetricId,
  usersManagementRoles
} from "./users-area-data";
import type {
  FilterOption,
  UsersAreaData,
  UsersAreaItem,
  UsersFilterLink,
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

type WorkforceSummaryState =
  | { status: "disabled"; summary?: never; error?: never }
  | { status: "loading"; summary?: never; error?: never }
  | { status: "error"; error: string; summary?: never }
  | { status: "ready"; summary: WorkforceSummaryResponse; error?: never };

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
  id: WorkforceKpiMetricId;
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
    icon: "bg-[color:var(--sn-sunken)] text-[color:var(--tlb-purple)]",
    line: "bg-[color:var(--tlb-lavender)]",
    ring: "ring-[color:var(--sn-border)]"
  },
  emerald: {
    icon: "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
    line: "bg-[oklch(0.75_0.1_150)]",
    ring: "ring-[oklch(0.88_0.06_150)]"
  },
  green: {
    icon: "bg-[oklch(0.95_0.045_145)] text-[oklch(0.58_0.13_145)]",
    line: "bg-[oklch(0.75_0.1_145)]",
    ring: "ring-[oklch(0.88_0.06_145)]"
  },
  orange: {
    icon: "bg-[#FFE8D9] text-[color:var(--tlb-orange)]",
    line: "bg-[#FFD8BD]",
    ring: "ring-[#FFD8BD]"
  },
  red: {
    icon: "bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]",
    line: "bg-[oklch(0.75_0.1_27)]",
    ring: "ring-[oklch(0.88_0.06_27)]"
  },
  violet: {
    icon: "bg-[color:var(--sn-sunken)] text-[color:var(--tlb-lavender)]",
    line: "bg-[color:var(--tlb-lavender)]",
    ring: "ring-[color:var(--sn-border)]"
  }
} satisfies Record<KpiTone, { icon: string; line: string; ring: string }>;

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
  // Admin / Super Admin manage profiles directly from the Users area (edit +
  // assignments). Champ / Area Manager stay request-driven here; their scoped
  // password access is gated separately by the backend in the profile modal.
  const canDirectlyManageProfiles =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersAreaState>({ status: "loading" });
  const [summaryState, setSummaryState] = useState<WorkforceSummaryState>({
    status: "disabled"
  });
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
    const summaryRole = getScopedWorkforceSummaryRole(user?.role, activeSection);

    if (!canLoadWorkforceSummary(user?.role) || !summaryRole) {
      setSummaryState({ status: "disabled" });
      return;
    }

    const requestedSummaryRole = summaryRole;
    let alive = true;

    async function loadWorkforceSummary() {
      setSummaryState({ status: "loading" });

      try {
        const summary = await usersApi.workforceSummary({
          period: "this-month",
          role: requestedSummaryRole,
          ...toWorkforceSummaryFilters(filters)
        });

        if (alive) {
          setSummaryState({ status: "ready", summary });
        }
      } catch (caughtError) {
        if (alive) {
          setSummaryState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load workforce summary."
          });
        }
      }
    }

    void loadWorkforceSummary();

    return () => {
      alive = false;
    };
  }, [
    activeSection,
    filters.areaManagerId,
    filters.chainId,
    filters.champId,
    filters.vendorId,
    refreshToken,
    user?.role
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
  const scopedFilterOptions = useMemo(
    () => deriveVisibleFilterOptions(filters, data.filterLinks),
    [
      data.filterLinks,
      filters.areaManagerId,
      filters.chainId,
      filters.champId,
      filters.vendorId
    ]
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
  const allowedDeductionRoles = getAllowedDeductionTargetRoles(user?.role);
  const showAdminFilters = viewerIsAdmin;

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    const sanitized = sanitizeFiltersForOptions(filters, scopedFilterOptions);

    if (!sameDirectoryFilters(filters, sanitized)) {
      setFilters(sanitized);
      setPageBySection(initialPages);
    }
  }, [filters, scopedFilterOptions, state.status]);

  function refreshUsersArea() {
    setRefreshToken((current) => current + 1);
  }

  function resetPages() {
    setPageBySection(initialPages);
  }

  function updateFilter(key: DirectoryFilterKey, value: string) {
    setFilters((current) => {
      const nextFilters = { ...current, [key]: value };
      return sanitizeFiltersForOptions(
        nextFilters,
        deriveVisibleFilterOptions(nextFilters, data.filterLinks)
      );
    });
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

  function openDeduction(target: UsersAreaItem) {
    setRequestError(null);

    if (!isDeductionTargetRole(target.user.role)) {
      return;
    }

    const activeAssignment =
      target.assignment?.status === "ACTIVE" ? target.assignment : null;

    setRequestDraft({
      initialTarget: {
        chainId: activeAssignment ? target.chain?.id : undefined,
        chainName: activeAssignment ? target.chain?.chainName : undefined,
        ibsId: "ibsId" in target.user ? target.user.ibsId : null,
        name: target.user.nameEn,
        role: target.user.role,
        shopperId: "shopperId" in target.user ? target.user.shopperId : null,
        userId: target.user.id,
        vendorId: activeAssignment ? target.vendor?.id : undefined,
        vendorName: activeAssignment ? target.vendor?.vendorName : undefined
      },
      targetRole: target.user.role,
      type: "DEDUCTION"
    });
  }

  function handleCreated() {
    setRequestDraft(null);
    refreshUsersArea();
  }

  const userActions: UsersActionHandlers = {
    activeMenuKey: openActionMenu,
    onOpenDeduction: openDeduction,
    onOpenResignation: openResignation,
    onOpenTransfer: (item) => void openTransfer(item),
    onToggleMenu: (key) =>
      setOpenActionMenu((current) => (current === key ? null : key)),
    viewerRole: user?.role
  };

  return (
    <main className="grid min-w-0 gap-4 lg:gap-5">
      <UsersPageHeader
        loading={
          state.status === "loading" || summaryState.status === "loading"
        }
        onRefresh={refreshUsersArea}
      />
      <RoleSelectorCards
        activeSection={activeSection}
        counts={sectionCounts}
        loading={state.status === "loading"}
        onSelect={selectSection}
        sections={visibleSections}
      />
      <MovementKpiCards summaryState={summaryState} />
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
        options={scopedFilterOptions}
        query={query}
        sectionLabel={getUsersSectionLabel(activeSection, user?.role)}
        showAdminFilters={showAdminFilters}
        viewMode={viewMode}
      />

      {requestError ? (
        <div className="rounded-2xl border border-[oklch(0.88_0.06_27)] bg-[oklch(0.95_0.035_27)] p-4 text-sm font-medium text-[oklch(0.55_0.19_27)]">
          {requestError}
        </div>
      ) : null}

      {selectedUserId ? (
        <OperationalUserProfileModal
          actions={{
            onDeduction: allowedDeductionRoles.length
              ? (profileUser, profile) => {
                  if (
                    !isDeductionTargetRole(profileUser.role) ||
                    !allowedDeductionRoles.includes(profileUser.role)
                  ) {
                    return;
                  }

                  if (profile) {
                    openDeduction(toUsersAreaItemFromProfile(profile));
                  } else if (selectedItem) {
                    openDeduction(selectedItem);
                  }
                }
              : undefined,
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
          allowDirectProfileMutation={canDirectlyManageProfiles}
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
    <section className="flex flex-col gap-3 rounded-2xl border border-[#FFD8BD] bg-gradient-to-r from-[color:var(--sn-card)] via-[color:var(--sn-card)] to-[#FFE8D9]/45 px-4 py-3 shadow-[0_8px_22px_rgba(65,21,23,0.05)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="max-w-2xl text-sm font-medium leading-6 text-[color:var(--sn-body)]">
          Operational workforce, assignments, and lifecycle movement.
        </p>
        <p className="mt-0.5 text-xs font-semibold text-[color:var(--tlb-orange)]">
          Live users, guarded sections, and assignment-based context.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button
          aria-disabled="true"
          className="h-9 rounded-xl border-[#FFD8BD] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-body)] shadow-sm hover:bg-[color:var(--sn-card)]"
          type="button"
          variant="outline"
        >
          <CalendarDays className="mr-2 h-4 w-4 text-primary" />
          This month
        </Button>
        <Button
          className="h-9 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-body)] shadow-sm hover:bg-[#FFE8D9]/60"
          disabled={loading}
          onClick={onRefresh}
          type="button"
          variant="outline"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[color:var(--sn-muted)]" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4 text-[color:var(--sn-muted)]" />
          )}
          Refresh
        </Button>
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
      className="grid gap-3 md:grid-cols-3"
    >
      {sections.map((card) => {
        const Icon = roleIcons[card.id];
        const active = activeSection === card.id;

        return (
          <button
            aria-pressed={active}
            className={cn(
              "group relative min-h-[118px] overflow-hidden rounded-[16px] border bg-[color:var(--sn-card)] p-4 text-left shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              active
                ? "border-[#FFD8BD] bg-gradient-to-br from-[#FFE8D9] via-[color:var(--sn-card)] to-[color:var(--sn-card)] shadow-[0_16px_34px_rgba(255,89,0,0.14)]"
                : "border-[color:var(--sn-border)] hover:border-[#FFD8BD] hover:bg-[#FFE8D9]/20 hover:shadow-[0_12px_28px_rgba(65,21,23,0.07)]"
            )}
            key={card.id}
            onClick={() => onSelect(card.id)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-0 top-0 h-1 transition",
                active ? "bg-primary" : "bg-transparent group-hover:bg-[#FFD8BD]"
              )}
            />
            <span className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 transition",
                  active
                    ? "bg-[color:var(--tlb-orange)] text-white shadow-[0_10px_20px_rgba(249,115,22,0.20)] ring-[#FFD8BD]"
                    : "bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)] ring-[color:var(--sn-border)] group-hover:bg-[#FFE8D9] group-hover:text-primary group-hover:ring-[#FFD8BD]"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <Badge
                className={cn(
                  "rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold",
                  active
                    ? "bg-[color:var(--sn-card)] text-primary shadow-sm"
                    : "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)] group-hover:bg-[color:var(--sn-card)] group-hover:text-primary"
                )}
              >
                {loading ? "..." : formatCount(counts[card.id])}
              </Badge>
            </span>
            <span className="mt-4 block text-base font-semibold text-[color:var(--sn-ink)]">
              {card.label}
            </span>
            <span className="mt-1 block text-xs font-semibold text-[color:var(--sn-muted)]">
              {card.subtitle}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-4 block h-1.5 rounded-full",
                active ? "bg-[#FFD8BD]" : "bg-[color:var(--sn-sunken)] group-hover:bg-[#FFD8BD]"
              )}
            />
          </button>
        );
      })}
    </section>
  );
}

function MovementKpiCards({
  summaryState
}: {
  summaryState: WorkforceSummaryState;
}) {
  return (
    <section
      aria-label="Workforce movement"
      className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {movementKpiCards.map((card) => (
        <MovementKpiCard
          card={card}
          key={card.id}
          summaryState={summaryState}
        />
      ))}
    </section>
  );
}

function MovementKpiCard({
  card,
  summaryState
}: {
  card: (typeof movementKpiCards)[number];
  summaryState: WorkforceSummaryState;
}) {
  const tone = kpiToneStyles[card.tone];
  const display = getMovementKpiCardDisplay(card, summaryState);

  return (
    <article
      aria-busy={summaryState.status === "loading"}
      aria-disabled={summaryState.status === "disabled" ? "true" : undefined}
      className={cn(
        "min-h-[148px] rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] ring-1 ring-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1",
            tone.icon,
            tone.ring
          )}
        >
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[color:var(--sn-body)]">
            {card.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 text-[color:var(--sn-muted)]">
            {display.helper}
          </p>
        </div>
      </div>
      <p className="mt-4 text-lg font-semibold tracking-normal text-[color:var(--sn-ink)]">
        {display.value}
      </p>
      <div aria-hidden="true" className="mt-3 flex h-7 items-end gap-1">
        {sparklineHeights.map((height, index) => (
          <span
            className={cn("w-full rounded-full opacity-75", tone.line)}
            key={`${card.id}-${height}-${index}`}
            style={{ height }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-[color:var(--sn-muted)]">
        {display.footer}
      </p>
    </article>
  );
}

function getMovementKpiCardDisplay(
  card: (typeof movementKpiCards)[number],
  summaryState: WorkforceSummaryState
) {
  if (summaryState.status === "disabled") {
    return {
      footer: "Workforce summary",
      helper: "No workforce summary access",
      value: "Coming soon"
    };
  }

  if (summaryState.status === "loading") {
    return {
      footer: "This month",
      helper: "Loading workforce summary",
      value: "--"
    };
  }

  if (summaryState.status === "error") {
    return {
      footer: "Summary unavailable",
      helper: "Refresh to retry",
      value: "Unable to load"
    };
  }

  const { summary } = summaryState;
  const periodLabel = summary.period.label || "This month";

  return {
    footer: periodLabel,
    helper:
      card.id === "attrition-rate"
        ? `Average ${formatCount(summary.averageHeadcount)} headcount`
        : periodLabel,
    value: formatWorkforceSummaryMetric(summary, card.id)
  };
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
    <section className="overflow-hidden rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="border-b border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-3 sm:p-4">
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
  const filterSelectClass = cn(!filtersOpen && "hidden lg:block");

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(320px,1.15fr)_minmax(0,2.35fr)_auto] xl:items-start">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-1">
        <label className="relative min-w-0">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--sn-muted)]" />
          <Input
            className="h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] pl-9 pr-3 shadow-inner shadow-[color:var(--sn-border)]/60 placeholder:text-[color:var(--sn-muted)] focus:bg-[color:var(--sn-card)]"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, phone, shopper ID, branch..."
            type="search"
            value={query}
          />
        </label>

        <Button
          aria-expanded={filtersOpen}
          className={cn(
            "h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-body)] shadow-sm hover:bg-[#FFE8D9]/60 lg:hidden",
            hasActiveFilters(filters) &&
              "border-primary/25 bg-brand-soft text-primary hover:bg-brand-soft"
          )}
          onClick={onToggleFilters}
          type="button"
          variant="outline"
        >
          <SlidersHorizontal
            className={cn(
              "mr-2 h-4 w-4",
              hasActiveFilters(filters) ? "text-primary" : "text-[color:var(--sn-muted)]"
            )}
          />
          Filters
        </Button>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
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
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(180px,220px)] xl:justify-end">
        <Button
          aria-disabled="true"
          className="h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-muted)] shadow-sm hover:bg-[color:var(--sn-card)]"
          disabled
          title="Column customization is not part of Phase 1."
          type="button"
          variant="outline"
        >
          <Columns3 className="mr-2 h-4 w-4" />
          Columns
        </Button>

        <div className="grid h-11 grid-cols-2 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-1 shadow-inner shadow-[color:var(--sn-border)]/40">
          <button
            aria-pressed={viewMode === "rows"}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold",
              viewMode === "rows"
                ? "bg-[color:var(--sn-card)] text-primary shadow-sm"
                : "text-[color:var(--sn-muted)] hover:text-[color:var(--sn-ink)]"
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
                ? "bg-[color:var(--sn-card)] text-primary shadow-sm"
                : "text-[color:var(--sn-muted)] hover:text-[color:var(--sn-ink)]"
            )}
            onClick={() => onViewModeChange("cards")}
            type="button"
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
        </div>
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
        className="h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-sm font-medium text-[color:var(--sn-body)] shadow-sm hover:border-[#FFD8BD]"
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
        className="h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-sm font-medium text-[color:var(--sn-body)] shadow-sm hover:border-[#FFD8BD]"
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
    <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--sn-border)] bg-[#FFE8D9]/20 px-3 py-2.5 sm:px-4">
      {active.map(([key, value]) => (
        <button
          className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#FFD8BD] bg-[color:var(--sn-card)] px-2.5 text-[11px] font-semibold text-[color:var(--sn-body)] shadow-sm transition hover:border-primary/25 hover:bg-brand-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          key={key}
          onClick={() => onClearFilter(key)}
          type="button"
        >
          <span className="text-[color:var(--sn-muted)]">{getFilterName(key)}:</span>
          {getFilterLabel(key, value, options)}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <button
        className="h-7 rounded-lg px-2 text-[11px] font-semibold text-primary hover:bg-[color:var(--sn-card)]"
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
          <tr className="border-b border-[color:var(--sn-border)] bg-[#FBF9F5] text-[11px] font-semibold uppercase tracking-normal text-[color:var(--sn-muted)]">
            <th className="px-4 py-3.5">User</th>
            <th className="px-3 py-3.5">Role</th>
            <th className="px-3 py-3.5">Operational Context</th>
            <th className="px-3 py-3.5">Manager</th>
            <th className="px-3 py-3.5">Lifecycle</th>
            <th className="w-[150px] px-3 py-3.5">Contact</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--sn-border)] bg-[color:var(--sn-card)]">
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
      className="cursor-pointer text-sm text-[color:var(--sn-body)] transition hover:bg-[#FDF8F2]"
      onClick={() => onOpenProfile(item.user.id)}
    >
      <td className="px-4 py-4 align-middle">
        <UserIdentity item={item} />
      </td>
      <td className="px-3 py-4 align-middle">
        <RoleBadge role={item.user.role} />
      </td>
      <td className="px-3 py-4 align-middle">
        <OperationalContext item={item} />
      </td>
      <td className="px-3 py-4 align-middle">
        <ManagerCell item={item} />
      </td>
      <td className="px-3 py-4 align-middle">
        <LifecycleBadge item={item} />
      </td>
      <td className="w-[150px] px-3 py-4 align-middle">
        <ContactCell item={item} />
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex justify-end gap-2">
          <Button
            className="h-9 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-body)] shadow-sm hover:border-[#FFD8BD] hover:bg-[#FFE8D9]/60"
            onClick={(event) => {
              event.stopPropagation();
              onOpenProfile(item.user.id);
            }}
            type="button"
            variant="outline"
          >
            <Eye className="mr-2 h-4 w-4 text-[color:var(--sn-muted)]" />
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
    <article className="rounded-[16px] border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity item={item} />
        <LifecycleBadge item={item} />
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-normal text-[color:var(--sn-muted)]">
            Role
          </span>
          <RoleBadge role={item.user.role} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-normal text-[color:var(--sn-muted)]">
            Operational Context
          </span>
          <div className="mt-1">
            <OperationalContext item={item} />
          </div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-normal text-[color:var(--sn-muted)]">
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
          className="h-11 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)] shadow-sm hover:border-[#FFD8BD] hover:bg-[#FFE8D9]/60"
          onClick={() => onOpenProfile(item.user.id)}
          type="button"
          variant="outline"
        >
          <Eye className="mr-2 h-4 w-4 text-[color:var(--sn-muted)]" />
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
        <span className="block truncate text-sm font-semibold text-[color:var(--sn-ink)]">
          {item.user.nameEn}
        </span>
        <span className="block truncate text-xs font-medium text-[color:var(--sn-muted)]">
          {getUserIdentifier(item.user)}
        </span>
      </span>
    </div>
  );
}

function OperationalContext({ item }: { item: UsersAreaItem }) {
  const context = getOperationalContextDisplay(item);

  return (
    <div className="min-w-0 border-l border-[color:var(--sn-border)] pl-3">
      <p className="truncate text-sm font-semibold text-[color:var(--sn-body)]">
        {context.primary}
      </p>
      <p className="truncate text-xs font-medium text-[color:var(--sn-muted)]">
        {context.secondary}
      </p>
      <p className="truncate text-xs text-[color:var(--sn-faint)]">{context.meta}</p>
    </div>
  );
}

function ManagerCell({ item }: { item: UsersAreaItem }) {
  const manager = getManagerDisplay(item);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFE8D9] text-xs font-semibold text-primary ring-1 ring-[#FFD8BD]">
        {getInitials(manager.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--sn-body)]">
          {manager.name}
        </span>
        <span className="block truncate text-xs font-medium text-[color:var(--sn-muted)]">
          {manager.role}
        </span>
      </span>
    </div>
  );
}

function ContactCell({ item }: { item: UsersAreaItem }) {
  return (
    <span className="inline-flex max-w-[150px] items-center gap-2 rounded-full bg-[color:var(--sn-sunken)] px-2.5 py-1 text-sm font-medium text-[color:var(--sn-body)] ring-1 ring-[color:var(--sn-border)]">
      <Phone className="h-4 w-4 shrink-0 text-[color:var(--sn-muted)]" />
      <span className="truncate">{item.user.phoneNumber}</span>
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      className={cn(
        "rounded-full border-transparent px-2.5 py-1 text-[11px] font-semibold",
        role === "PICKER" && "bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] ring-1 ring-[#FFD8BD]",
        role === "CHAMP" && "bg-[color:var(--sn-sunken)] text-[color:var(--tlb-purple)] ring-1 ring-[color:var(--sn-border)]",
        role === "AREA_MANAGER" && "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)] ring-1 ring-[oklch(0.88_0.06_150)]",
        (role === "ADMIN" || role === "SUPER_ADMIN") &&
          "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)] ring-1 ring-[color:var(--sn-border)]"
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
        "gap-1.5 rounded-full border-transparent px-2.5 py-1 text-[11px] font-semibold",
        lifecycle.tone === "active" &&
          "bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)] ring-1 ring-[oklch(0.88_0.06_150)]",
        lifecycle.tone === "pending" &&
          "bg-[#FFE8D9] text-[color:var(--tlb-orange-900)] ring-1 ring-[#FFD8BD]",
        lifecycle.tone === "blocked" &&
          "bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)] ring-1 ring-[oklch(0.88_0.06_27)]",
        lifecycle.tone === "muted" &&
          "bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)] ring-1 ring-[color:var(--sn-border)]"
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
    <div className="flex flex-col gap-3 border-t border-[color:var(--sn-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm font-medium text-[color:var(--sn-muted)]">
        {sectionLabel}: showing {from} to {to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-muted)] disabled:text-[color:var(--sn-faint)]"
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
                : "border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)]"
            )}
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            type="button"
          >
            {pageNumber}
          </button>
        ))}
        <button
          className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-muted)] disabled:text-[color:var(--sn-faint)]"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          type="button"
        >
          <span className="sr-only">Next page</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="inline-flex h-9 items-center rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-sm font-semibold text-[color:var(--sn-body)]">
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
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-[color:var(--sn-ink)]">
          Users could not be loaded.
        </p>
        <p className="mt-1 max-w-md text-sm leading-6 text-[color:var(--sn-muted)]">{error}</p>
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
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--sn-sunken)] text-[color:var(--sn-muted)]">
          <UsersRound className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-[color:var(--sn-ink)]">
          No {sectionLabel.toLowerCase()} found.
        </p>
        <p className="mt-1 max-w-md text-sm leading-6 text-[color:var(--sn-muted)]">
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
    const filterLinks = filterLinksFromScopedItems(pickers);

    return {
      champs: [],
      filterLinks,
      filters: deriveVisibleFilterOptions(emptyFilters, filterLinks),
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
    const filterLinks = filterLinksFromScopedItems(scopedItems);

    return {
      champs: keepUsersSectionItems("champs", champs),
      filterLinks,
      filters: deriveVisibleFilterOptions(emptyFilters, filterLinks),
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
    const filterLinks = filterLinksFromAdminOrganization(organization.chains);

    return {
      champs: keepUsersSectionItems("champs", champs.items),
      filterLinks,
      filters: deriveVisibleFilterOptions(emptyFilters, filterLinks),
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
    const displayItems = applyClientFilters(guardedItems, filters);

    return {
      items: displayItems,
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

function sameDirectoryFilters(
  left: DirectoryFilters,
  right: DirectoryFilters
) {
  return (
    left.areaManagerId === right.areaManagerId &&
    left.chainId === right.chainId &&
    left.champId === right.champId &&
    left.status === right.status &&
    left.vendorId === right.vendorId
  );
}

function emptyUsersAreaData(): UsersAreaData {
  return {
    champs: [],
    filterLinks: [],
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

function toWorkforceSummaryFilters(filters: DirectoryFilters): Pick<
  WorkforceSummaryParams,
  "areaManagerId" | "chainId" | "champId" | "vendorId"
> {
  return {
    areaManagerId: filters.areaManagerId || undefined,
    chainId: filters.chainId || undefined,
    champId: filters.champId || undefined,
    vendorId: filters.vendorId || undefined
  };
}

function filterLinksFromScopedItems(items: UsersAreaItem[]): UsersFilterLink[] {
  return items.map((item) => ({
    areaManager: item.areaManager
      ? {
          hint: item.areaManager.phoneNumber,
          id: item.areaManager.id,
          label: item.areaManager.nameEn
        }
      : null,
    chain: item.chain
      ? {
          hint: item.chain.chainCode,
          id: item.chain.id,
          label: item.chain.chainName
        }
      : null,
    champ: item.champ
      ? {
          hint: item.champ.phoneNumber,
          id: item.champ.id,
          label: item.champ.nameEn
        }
      : null,
    vendor: item.vendor
      ? {
          hint: item.vendor.vendorCode,
          id: item.vendor.id,
          label: item.vendor.vendorName
        }
      : null
  }));
}

function filterLinksFromAdminOrganization(
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
): UsersFilterLink[] {
  return chains.flatMap((chain): UsersFilterLink[] => {
    const chainOption = {
      hint: chain.chainCode,
      id: chain.id,
      label: chain.chainName
    };
    const areaManagerOption = chain.currentAreaManager
      ? {
          hint: chain.currentAreaManager.phoneNumber,
          id: chain.currentAreaManager.id,
          label: chain.currentAreaManager.nameEn
        }
      : null;

    if (!chain.branches.length) {
      return [
        {
          areaManager: areaManagerOption,
          chain: chainOption,
          champ: null,
          vendor: null
        }
      ];
    }

    return chain.branches.map((branch) => ({
      areaManager: areaManagerOption,
      chain: chainOption,
      champ: branch.currentChamp
        ? {
            hint: branch.currentChamp.phoneNumber,
            id: branch.currentChamp.id,
            label: branch.currentChamp.nameEn
          }
        : null,
      vendor: {
        hint: branch.vendorCode,
        id: branch.id,
        label: branch.vendorName
      }
    }));
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
