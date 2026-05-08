import type { SafeUser } from "@/lib/auth/types";
import { apiRequest } from "./request";

export type AssignmentStatus = "ACTIVE" | "CLOSED";
export type EntityStatus = "ACTIVE" | "INACTIVE";

export interface UserSummary {
  id: string;
  role: SafeUser["role"];
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  accountStatus: SafeUser["accountStatus"];
  employmentStatus: SafeUser["employmentStatus"];
  profileStatus: SafeUser["profileStatus"];
}

export interface ChainSummary {
  id: string;
  chainName: string;
  chainCode: string;
  status: EntityStatus;
}

export interface VendorSummary {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId: string | null;
  status: EntityStatus;
  chainId: string;
  area: string | null;
  city: string | null;
  chain?: ChainSummary;
}

export interface AssignmentSummary {
  id: string;
  status: AssignmentStatus;
  startDate: string;
  endDate?: string | null;
}

export interface PickerWorkspace {
  profile: SafeUser;
  profileCompletion: {
    status: SafeUser["profileStatus"];
    missingFields: string[];
  };
  currentAssignment: AssignmentSummary | null;
  branch: VendorSummary | null;
  chain: ChainSummary | null;
  champ: UserSummary | null;
  areaManager: UserSummary | null;
}

export interface ScopedPicker {
  assignment: AssignmentSummary;
  picker: UserSummary;
}

export interface ScopedChamp {
  assignment: AssignmentSummary;
  champ: UserSummary;
}

export interface ChampBranch {
  assignment: AssignmentSummary;
  vendor: VendorSummary;
  chain: ChainSummary;
  activePickerCount: number;
  pickers: ScopedPicker[];
}

export interface ChampWorkspace {
  champ: UserSummary;
  branches: ChampBranch[];
  totals: {
    branches: number;
    activePickers: number;
  };
  placeholders: {
    requests: string;
    actions: string;
  };
}

export interface AreaManagerVendor {
  vendor: VendorSummary;
  activePickerCount: number;
  activeChampCount: number;
  pickers: ScopedPicker[];
  champs: ScopedChamp[];
}

export interface AreaManagerChain {
  assignment: AssignmentSummary;
  chain: ChainSummary;
  vendorCount: number;
  activePickerCount: number;
  activeChampCount: number;
  vendors: AreaManagerVendor[];
}

export interface AreaManagerWorkspace {
  areaManager: UserSummary;
  chains: AreaManagerChain[];
  usersUnderMe: UserSummary[];
  totals: {
    chains: number;
    vendors: number;
    activePickers: number;
    activeChamps: number;
  };
  placeholders: {
    requests: string;
    approvals: string;
  };
}

export interface AdminWorkspace {
  totals: {
    chains: number;
    activeChains: number;
    vendors: number;
    activeVendors: number;
    users: number;
    activeUsers: number;
    activePickerAssignments: number;
    activeChampAssignments: number;
    activeAreaManagerAssignments: number;
  };
  recent: {
    chains: ChainSummary[];
    vendors: VendorSummary[];
    users: UserSummary[];
  };
  placeholders: {
    pendingAdminActions: string;
  };
}

export const workspacesApi = {
  picker() {
    return apiRequest<PickerWorkspace>("/workspaces/picker");
  },
  champ() {
    return apiRequest<ChampWorkspace>("/workspaces/champ");
  },
  areaManager() {
    return apiRequest<AreaManagerWorkspace>("/workspaces/area-manager");
  },
  admin() {
    return apiRequest<AdminWorkspace>("/workspaces/admin");
  }
};
