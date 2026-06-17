import { apiGet } from "./request";

export type AreaManagerPerformanceStatus =
  | "IN_TARGET"
  | "WATCH"
  | "NEEDS_ACTION"
  | "LOW_VOLUME"
  | "NO_KPI";

export interface AreaManagerRankRow {
  rank: number;
  areaManagerId: string;
  areaManagerName: string;
  chainsCount: number;
  totalOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  isCurrentUser: boolean;
  status?: AreaManagerPerformanceStatus;
}

export interface AreaManagerPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  scope: {
    areaManagerId: string;
    areaManagerName: string;
    selectedChainId: string | null;
    chains: Array<{
      chainId: string;
      chainName: string;
    }>;
    totals: {
      chainsCount: number;
      branchesCount: number;
      champsCount: number;
      pickersCount: number;
    };
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
  latestRequests: {
    available: boolean;
    rows: Array<{
      id: string;
      type: string;
      targetUserName?: string | null;
      targetShopperId?: string | null;
      branchName?: string | null;
      chainName?: string | null;
      requestedByName?: string | null;
      status: string;
      ageLabel?: string;
      createdAt: string;
    }>;
    totalOpenInScope?: number;
    reason?: string;
  };
  areaManagersRanking: {
    available: boolean;
    basis: "UHO_ONLY";
    currentAreaManager: AreaManagerRankRow | null;
    rows: AreaManagerRankRow[];
    reason?: string;
  };
  branchesPerformance: {
    available: boolean;
    rows: Array<{
      vendorId: string;
      vendorName: string;
      chainId: string;
      chainName: string;
      champName?: string | null;
      totalOrders: number;
      totalPickers: number;
      unhealthyRate: number | null;
      attendanceHealthRate: number | null;
      status: AreaManagerPerformanceStatus;
      reasonLabels: string[];
    }>;
    totalRows: number;
    reason?: string;
  };
  champsPerformance: {
    available: boolean;
    rows: Array<{
      champId: string;
      champName: string;
      branchesCount: number;
      totalPickers: number;
      totalOrders: number;
      unhealthyRate: number | null;
      attendanceHealthRate: number | null;
      status: AreaManagerPerformanceStatus;
      reasonLabels: string[];
    }>;
    totalRows: number;
    reason?: string;
  };
}

export const areaManagerPerformanceApi = {
  summary(params: {
    dateFrom: string;
    dateTo: string;
    chainId?: string;
  }): Promise<AreaManagerPerformanceSummary> {
    const query = new URLSearchParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });

    if (params.chainId) {
      query.set("chainId", params.chainId);
    }

    return apiGet<AreaManagerPerformanceSummary>(
      `/workspaces/area-manager/performance-summary?${query.toString()}`
    );
  }
};
