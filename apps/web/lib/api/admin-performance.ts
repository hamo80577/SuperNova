import { apiGet } from "./request";

export type AdminPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";

export interface AdminAreaManagerRankRow {
  rank: number;
  areaManagerId: string;
  areaManagerName: string;
  chainsCount: number;
  branchesCount: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminChampRankRow {
  rank: number;
  champId: string;
  champName: string;
  branchesCount: number;
  totalPickers: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminBranchRankRow {
  rank: number;
  vendorId: string;
  vendorName: string;
  chainId: string;
  chainName: string;
  champName?: string | null;
  totalPickers: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminTopPickerRow {
  rank: number;
  pickerId: string;
  pickerName: string;
  shopperId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  chainId?: string | null;
  chainName?: string | null;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  status: AdminPerformanceStatus;
}

export interface AdminPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  filters: {
    selectedChainId: string | null;
    selectedVendorId: string | null;
    chains: Array<{
      chainId: string;
      chainName: string;
    }>;
    branches: Array<{
      vendorId: string;
      vendorName: string;
      chainId: string;
      chainName: string;
    }>;
  };
  scopeTotals: {
    chainsCount: number;
    branchesCount: number;
    areaManagersCount: number;
    champsCount: number;
    pickersCount: number;
  };
  ordersKpi: {
    available: boolean;
    totalOrders?: number;
    unhealthyOrders?: number;
    unhealthyRate?: number | null;
    orderNotOnTime?: number;
    orderNotOnTimeRate?: number | null;
    target?: {
      configured: boolean;
      unhealthyRateTarget?: number | null;
      status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET";
    };
    trend?: Array<{
      date: string;
      unhealthyRate: number;
      totalOrders: number;
      unhealthyOrders: number;
    }>;
    reason?: string;
  };
  attendance: {
    available: boolean;
    attendanceHealthRate?: number | null;
    totalShifts?: number;
    cleanShifts?: number;
    issueShifts?: number;
    totalShiftErrors?: number;
    lateCount?: number;
    absentCount?: number;
    under8Count?: number;
    over15Count?: number;
    includedRoles: Array<"PICKER" | "CHAMP">;
    reason?: string;
  };
  ticketsSummary: {
    available: boolean;
    totalTickets?: number;
    openedInPeriod?: number;
    closedInPeriod?: number;
    openNow?: number;
    waitingMyAction?: number;
    rejectedOrCancelled?: number;
    reason?: string;
  };
  areaManagersRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminAreaManagerRankRow[];
    totalRows: number;
    reason?: string;
  };
  champsRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminChampRankRow[];
    totalRows: number;
    reason?: string;
  };
  branchesRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    rows: AdminBranchRankRow[];
    totalRows: number;
    reason?: string;
  };
  topPickers: {
    available: boolean;
    basis: "UHO_ONLY_WITH_MINIMUM_ORDERS";
    minOrdersRequired: number;
    rows: AdminTopPickerRow[];
    totalEligible: number;
    reason?: string;
  };
}

export const adminPerformanceApi = {
  summary(params: {
    dateFrom: string;
    dateTo: string;
    chainId?: string;
    vendorId?: string;
  }): Promise<AdminPerformanceSummary> {
    const query = new URLSearchParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });

    if (params.chainId) {
      query.set("chainId", params.chainId);
    }
    if (params.vendorId) {
      query.set("vendorId", params.vendorId);
    }

    return apiGet<AdminPerformanceSummary>(
      "/workspaces/admin/performance-summary?" + query.toString()
    );
  }
};

