import type { PageMeta } from "@/lib/api/organization";
import type {
  AssignmentSummary,
  ChainSummary,
  UserSummary,
  VendorSummary
} from "@/lib/api/workspaces";
import type { SafeUser } from "@/lib/auth/types";

export type UsersSectionId = "pickers" | "champs" | "management";
export type ViewMode = "cards" | "rows";
export type UsersFilterKey = "chainId" | "vendorId" | "areaManagerId" | "champId";

export type UsersAreaItem = {
  key: string;
  user: UserSummary | SafeUser;
  assignment?: AssignmentSummary | null;
  vendor?: VendorSummary | null;
  chain?: ChainSummary | null;
  champ?: UserSummary | null;
};

export type UsersFilters = Record<UsersFilterKey, string>;
export type FilterOption = { id: string; label: string; hint?: string };

export type UsersFilterOptions = {
  chains: FilterOption[];
  vendors: FilterOption[];
  areaManagers: FilterOption[];
  champs: FilterOption[];
};

export type UsersAreaData = {
  pickers: UsersAreaItem[];
  champs: UsersAreaItem[];
  management: UsersAreaItem[];
  meta: Partial<Record<UsersSectionId, PageMeta>>;
  filters: UsersFilterOptions;
};
