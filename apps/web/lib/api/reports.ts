import { apiGet } from "./request";
import type { ChainSummary, VendorSummary } from "./workspaces";

export interface CountBreakdownItem {
  key: string;
  count: number;
}

export interface AdminReportsOverview {
  scopeSummary: { scope: "SYSTEM" };
  cards: {
    totalChains: number;
    activeChains: number;
    totalVendors: number;
    activeVendors: number;
    activePickers: number;
    archivedDeactivatedPickers: number;
    pendingApprovals: number;
    pendingAdminFinalActions: number;
  };
  breakdowns: {
    usersByRole: CountBreakdownItem[];
    usersByAccountStatus: CountBreakdownItem[];
    usersByEmploymentStatus: CountBreakdownItem[];
    usersByBlockStatus: CountBreakdownItem[];
    requestsByType: CountBreakdownItem[];
    requestsByStatus: CountBreakdownItem[];
    profileCompletion: CountBreakdownItem[];
    archiveBlockSummary: {
      archivedUsers: number;
      temporaryBlock: number;
      permanentBlock: number;
      noBlockAmongArchived: number;
    };
  };
  tables: {
    topChainsByActivePickerCount: Array<{
      chain: ChainSummary;
      activePickerCount: number;
    }>;
    topVendorsByActivePickerCount: Array<{
      vendor: VendorSummary | null;
      activePickerCount: number;
    }>;
  };
}

export interface AreaManagerReportsOverview {
  scopeSummary: {
    assignedChains: number;
    assignedVendors: number;
  };
  cards: {
    chains: number;
    vendors: number;
    activePickers: number;
    activeChamps: number;
    pendingApprovals: number;
    openActions: number;
  };
  breakdowns: {
    requestsByType: CountBreakdownItem[];
    requestsByStatus: CountBreakdownItem[];
    profileCompletion: CountBreakdownItem[];
    archiveBlockSummary: CountBreakdownItem[];
  };
  tables: {
    chains: Array<{
      chain: ChainSummary;
      vendorCount: number;
      activePickerCount: number;
      activeChampCount: number;
      vendors: Array<{
        vendor: VendorSummary;
        activePickerCount: number;
        activeChampCount: number;
      }>;
    }>;
    vendors: Array<{
      chain: ChainSummary;
      vendor: VendorSummary;
      activePickerCount: number;
      activeChampCount: number;
    }>;
  };
}

export interface ChampReportsOverview {
  scopeSummary: {
    assignedBranches: number;
  };
  cards: {
    assignedBranches: number;
    activePickers: number;
    openSubmittedRequests: number;
    completedOutcomes: number;
  };
  breakdowns: {
    profileCompletion: CountBreakdownItem[];
    requestsByType: CountBreakdownItem[];
    requestsByStatus: CountBreakdownItem[];
    workflowOutcomes: {
      newHiresCompleted: number;
      transfersCompleted: number;
      offboardingCompleted: number;
    };
  };
  tables: {
    branches: Array<{
      vendor: VendorSummary;
      chain: ChainSummary;
      activePickerCount: number;
    }>;
  };
}

export const reportsApi = {
  adminOverview() {
    return apiGet<AdminReportsOverview>("/reports/admin/overview");
  },
  areaManagerOverview() {
    return apiGet<AreaManagerReportsOverview>("/reports/area-manager/overview");
  },
  champOverview() {
    return apiGet<ChampReportsOverview>("/reports/champ/overview");
  }
};
