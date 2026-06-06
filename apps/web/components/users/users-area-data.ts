import type { UserRole } from "@/lib/auth/types";
import type {
  WorkforceSummaryResponse,
  WorkforceSummaryRole
} from "@/lib/api/users";
import type {
  FilterOption,
  UsersFilterLink,
  UsersFilterOptions,
  UsersSectionId
} from "./users-area-types";

export const usersManagementRoles: UserRole[] = [
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];

export function isAdminUsersRole(
  role: UserRole | undefined
): role is "ADMIN" | "SUPER_ADMIN" {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function getVisibleUserSections(role: UserRole | undefined) {
  if (role === "CHAMP") {
    return [
      {
        id: "pickers" as const,
        label: "My Pickers",
        subtitle: "Active workforce"
      }
    ];
  }

  if (role === "AREA_MANAGER") {
    return [
      {
        id: "pickers" as const,
        label: "My Pickers",
        subtitle: "Active workforce"
      },
      {
        id: "champs" as const,
        label: "My Champs",
        subtitle: "Branch leaders"
      }
    ];
  }

  if (isAdminUsersRole(role)) {
    return [
      {
        id: "pickers" as const,
        label: "All Pickers",
        subtitle: "Active workforce"
      },
      {
        id: "champs" as const,
        label: "All Champs",
        subtitle: "Branch leaders"
      },
      {
        id: "management" as const,
        label: "Management Users",
        subtitle: "Admins & Area Managers"
      }
    ];
  }

  return [];
}

export function isRoleAllowedInUsersSection(
  section: UsersSectionId,
  role: UserRole
) {
  if (section === "pickers") {
    return role === "PICKER";
  }

  if (section === "champs") {
    return role === "CHAMP";
  }

  return usersManagementRoles.includes(role);
}

export function keepUsersSectionItems<T extends { user: { role: UserRole } }>(
  section: UsersSectionId,
  items: T[]
) {
  return items.filter((item) =>
    isRoleAllowedInUsersSection(section, item.user.role)
  );
}

export function getUsersSectionLabel(
  section: UsersSectionId,
  viewerRole: UserRole | undefined
) {
  const visible = getVisibleUserSections(viewerRole);
  return visible.find((item) => item.id === section)?.label ?? "Users";
}

export type WorkforceKpiMetricId =
  | "starting-headcount"
  | "new-hires"
  | "exited"
  | "ending-headcount"
  | "attrition-rate"
  | "net-movement";

export function getWorkforceSummaryRole(
  section: UsersSectionId
): Exclude<WorkforceSummaryRole, "ALL"> {
  if (section === "champs") {
    return "CHAMP";
  }

  if (section === "management") {
    return "MANAGEMENT";
  }

  return "PICKER";
}

export function canLoadWorkforceSummary(role: UserRole | undefined) {
  return getVisibleUserSections(role).length > 0;
}

export function getScopedWorkforceSummaryRole(
  role: UserRole | undefined,
  section: UsersSectionId
): Exclude<WorkforceSummaryRole, "ALL"> | null {
  const visible = getVisibleUserSections(role);

  if (!visible.some((item) => item.id === section)) {
    return null;
  }

  return getWorkforceSummaryRole(section);
}

export function formatWorkforceSummaryMetric(
  summary: WorkforceSummaryResponse,
  metric: WorkforceKpiMetricId
) {
  if (metric === "starting-headcount") {
    return formatWorkforceNumber(summary.startingHeadcount);
  }

  if (metric === "new-hires") {
    return formatWorkforceNumber(summary.newHires);
  }

  if (metric === "exited") {
    return formatWorkforceNumber(summary.exited);
  }

  if (metric === "ending-headcount") {
    return formatWorkforceNumber(summary.endingHeadcount);
  }

  if (metric === "attrition-rate") {
    return `${formatWorkforceNumber(summary.attritionRate)}%`;
  }

  return formatWorkforceNumber(summary.netMovement);
}

export type UsersCascadingFilters = {
  chainId: string;
  vendorId: string;
  areaManagerId: string;
  champId: string;
};

export function deriveVisibleFilterOptions(
  filters: UsersCascadingFilters,
  links: UsersFilterLink[]
): UsersFilterOptions {
  return {
    areaManagers: optionsFromLinks(
      links,
      filters,
      "areaManagerId",
      (link) => link.areaManager ?? null
    ),
    chains: optionsFromLinks(
      links,
      filters,
      "chainId",
      (link) => link.chain ?? null
    ),
    champs: optionsFromLinks(
      links,
      filters,
      "champId",
      (link) => link.champ ?? null
    ),
    vendors: optionsFromLinks(
      links,
      filters,
      "vendorId",
      (link) => link.vendor ?? null
    )
  };
}

export function sanitizeFiltersForOptions<
  TFilters extends UsersCascadingFilters
>(filters: TFilters, options: UsersFilterOptions): TFilters {
  return {
    ...filters,
    areaManagerId: hasOption(options.areaManagers, filters.areaManagerId)
      ? filters.areaManagerId
      : "",
    chainId: hasOption(options.chains, filters.chainId) ? filters.chainId : "",
    champId: hasOption(options.champs, filters.champId) ? filters.champId : "",
    vendorId: hasOption(options.vendors, filters.vendorId)
      ? filters.vendorId
      : ""
  };
}

export function isBranchInChain(
  branchId: string,
  chainId: string,
  links: UsersFilterLink[]
) {
  return links.some(
    (link) => link.vendor?.id === branchId && link.chain?.id === chainId
  );
}

export function isChampRelatedToBranch(
  champId: string,
  branchId: string,
  links: UsersFilterLink[]
) {
  return links.some(
    (link) => link.champ?.id === champId && link.vendor?.id === branchId
  );
}

export function isAreaManagerRelatedToChain(
  areaManagerId: string,
  chainId: string,
  links: UsersFilterLink[]
) {
  return links.some(
    (link) =>
      link.areaManager?.id === areaManagerId && link.chain?.id === chainId
  );
}

function optionsFromLinks(
  links: UsersFilterLink[],
  filters: UsersCascadingFilters,
  ignoredKey: keyof UsersCascadingFilters,
  selectOption: (link: UsersFilterLink) => FilterOption | null
) {
  return uniqueOptions(
    links
      .filter((link) => linkMatchesFilters(link, filters, ignoredKey))
      .map(selectOption)
      .filter((option): option is FilterOption => Boolean(option))
  );
}

function linkMatchesFilters(
  link: UsersFilterLink,
  filters: UsersCascadingFilters,
  ignoredKey: keyof UsersCascadingFilters
) {
  if (
    ignoredKey !== "chainId" &&
    filters.chainId &&
    link.chain?.id !== filters.chainId
  ) {
    return false;
  }

  if (
    ignoredKey !== "vendorId" &&
    filters.vendorId &&
    link.vendor?.id !== filters.vendorId
  ) {
    return false;
  }

  if (
    ignoredKey !== "areaManagerId" &&
    filters.areaManagerId &&
    link.areaManager?.id !== filters.areaManagerId
  ) {
    return false;
  }

  if (
    ignoredKey !== "champId" &&
    filters.champId &&
    link.champ?.id !== filters.champId
  ) {
    return false;
  }

  return true;
}

function hasOption(options: FilterOption[], value: string) {
  return !value || options.some((option) => option.id === value);
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

function formatWorkforceNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2
  }).format(value);
}
