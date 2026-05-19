"use client";

import {
  ChevronLeft,
  ChevronRight,
  Users
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { NewRequestSheet } from "@/components/requests/forms/new-request-sheet";
import {
  type InitialTransferPicker,
  type NewRequestDraft
} from "@/components/requests/shared/request-types";
import { Button } from "@/components/ui/button";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { adminOrganizationApi } from "@/lib/api/admin-organization";
import { usersApi, type OperationalProfileResponse } from "@/lib/api/users";
import {
  type UserSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { OperationalUserProfileModal } from "./operational-user-profile-modal";
import {
  getAllowedResignationTargetRoles,
  isResignationTargetRole,
  type UsersActionHandlers
} from "./users-actions-menu";
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
import { UsersCardGrid } from "./users-card-grid";
import { UsersTableView } from "./users-table-view";
import { UsersTabs } from "./users-tabs";
import { UsersToolbar } from "./users-toolbar";

type UsersAreaState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: UsersAreaData; error?: never };

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

  const userActions: UsersActionHandlers = {
    activeMenuKey: openActionMenu,
    onOpenResignation: openResignation,
    onOpenTransfer: (item) => void openTransfer(item),
    onToggleMenu: (key) =>
      setOpenActionMenu((current) => (current === key ? null : key)),
    viewerRole: user?.role
  };

  return (
    <div className="grid gap-4">
      <UsersTabs
        activeSection={activeSection}
        counts={getSectionCounts(data, filters, debouncedQuery, viewerIsAdmin)}
        onSelect={selectSection}
        sections={visibleSections}
      />

      <UsersToolbar
        filters={filters}
        filtersOpen={filtersOpen}
        onChangeFilter={updateFilter}
        onClearAllFilters={clearAllFilters}
        onClearFilter={clearFilter}
        onQueryChange={updateQuery}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        onViewModeChange={setViewMode}
        options={data.filters}
        query={query}
        showAdvancedFilters={showAdvancedFilters}
        viewMode={viewMode}
        viewerRole={user?.role}
      />

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
            actions={userActions}
            items={activeResult.items}
            onOpenProfile={setSelectedUserId}
            sectionLabel={activeSectionLabel}
            viewMode={viewMode}
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

function UsersSection({
  actions,
  items,
  onOpenProfile,
  sectionLabel,
  viewMode
}: {
  actions: UsersActionHandlers;
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  sectionLabel: string;
  viewMode: ViewMode;
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
      <UsersTableView
        actions={actions}
        items={items}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <UsersCardGrid
      actions={actions}
      items={items}
      onOpenProfile={onOpenProfile}
    />
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

function isAdminRole(role: UserRole | undefined): role is "ADMIN" | "SUPER_ADMIN" {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
