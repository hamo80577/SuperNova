import type { SafeUser } from "@/lib/auth/types";
import type { PendingLifecycleRequestSummary, RequestSummary } from "./requests";
import { apiGet } from "./request";

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

export type PickerPerformancePeriodLabel =
  | "LAST_WEEK"
  | "THIS_MONTH"
  | "THIS_QUARTER"
  | "CUSTOM";

export type PickerRankReason =
  | "LOW_ORDER_VOLUME"
  | "NO_KPI_RECORDS"
  | "NOT_IN_SCOPE";

export interface PickerRankSummary {
  ranked: boolean;
  rank: number | null;
  previousRank: number | null;
  rankChange: number | null;
  totalEligible: number;
  displayLabel: string;
  percentile: number | null;
  percentileLabel: string | null;
  reason: PickerRankReason | null;
  minOrders: number;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  attendanceRate: number | null;
}

export interface PickerPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
    label: PickerPerformancePeriodLabel;
  };
  identity: {
    pickerName: string;
    role: "PICKER";
    shopperId: string | null;
    branchName: string | null;
    chainName: string | null;
    areaManagerName: string | null;
    champName: string | null;
  };
  attendance: {
    available: boolean;
    attendanceRate: number | null;
    previousAttendanceRate: number | null;
    attendanceRateDelta: number | null;
    attendanceHealthRate: number | null;
    previousAttendanceHealthRate: number | null;
    attendanceHealthRateDelta: number | null;
    presenceRate: number | null;
    totalShifts: number;
    cleanShifts: number;
    issueShifts: number;
    series: Array<{
      date: string;
      totalShifts: number;
      cleanShifts: number;
      issueShifts: number;
      attendanceHealthRate: number | null;
      totalShiftErrors: number;
    }>;
    scheduledShifts: number;
    attendedShifts: number;
    totalShiftErrors: number;
    lateCount: number;
    absentCount: number;
    under8Count: number;
    over15Count: number;
    under8HoursCount: number;
    over15HoursCount: number;
  };
  ordersKpi: {
    available: boolean;
    totalOrders: number;
    unhealthyOrders: number;
    unhealthyRate: number | null;
    orderNotOnTime: number;
    orderNotOnTimeRate: number | null;
    qcFailedOrders: number;
    partialRefund: number;
    outOfStock: number;
    priceModified: number;
    series: Array<{
      date: string;
      totalOrders: number;
      unhealthyOrders: number;
      unhealthyRate: number | null;
    }>;
    target: {
      configured: boolean;
      unhealthyRateTarget: number | null;
      status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET";
    };
  };
  ranking: {
    basis: "UHO_VOLUME_AWARE";
    minOrders: number;
    branch: PickerRankSummary;
    chain: PickerRankSummary;
    allTeam: PickerRankSummary;
  };
  deductions: {
    available: boolean;
    totalEffectiveDays: number;
    effectiveCasesCount: number;
    pendingHiddenByPolicy: boolean;
  };
  annualLeave: {
    available: boolean;
    eligibilityStatus:
      | "ELIGIBLE"
      | "NOT_ELIGIBLE"
      | "NOT_APPLICABLE"
      | "MISSING_JOINING_DATE";
    balanceDays: number;
    takenDays: number;
    remainingDays: number | null;
    message: string;
  };
}

export interface ScopedPicker {
  assignment: AssignmentSummary;
  picker: UserSummary;
  pendingRequest?: PendingLifecycleRequestSummary | null;
}

export interface ScopedChamp {
  assignment: AssignmentSummary;
  champ: UserSummary;
  pendingRequest?: PendingLifecycleRequestSummary | null;
}

export interface ChampBranch {
  assignment: AssignmentSummary;
  vendor: VendorSummary;
  chain: ChainSummary;
  activePickerCount: number;
  recentRequestCount: number;
  pendingRequestCount: number;
  pickers: ScopedPicker[];
}

export interface ChampWorkspace {
  champ: UserSummary;
  branches: ChampBranch[];
  totals: {
    branches: number;
    activePickers: number;
    pendingRequests: number;
    recentRequests: number;
  };
  placeholders: {
    requests: string;
    actions: string;
  };
}

export interface ChampBranchesResponse {
  branches: ChampBranch[];
  totals: ChampWorkspace["totals"];
}

export interface ChampBranchDetail extends ChampBranch {
  areaManagerAssignment: AssignmentSummary | null;
  areaManager: UserSummary | null;
  recentRequests: RequestSummary[];
}

export interface ChampPerformanceSummary {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  scope: {
    champName: string;
    selectedVendorId: string | null;
    selectedBranch: {
      vendorId: string;
      vendorName: string;
      chainId: string;
      chainName: string;
      areaManagerName: string | null;
      activePickersCount: number;
    } | null;
    branches: Array<{
      vendorId: string;
      vendorName: string;
      chainId: string;
      chainName: string;
    }>;
  };
  quickActions: Record<
    "newHire" | "transfer" | "deduction" | "resignation",
    { enabled: boolean; href?: string }
  >;
  attendance: {
    available: boolean;
    reason?: string;
    attendanceHealthRate?: number | null;
    totalShifts?: number;
    cleanShifts?: number;
    issueShifts?: number;
    totalShiftErrors?: number;
    lateCount?: number;
    absentCount?: number;
    under8Count?: number;
    over15Count?: number;
  };
  ordersKpi: {
    available: boolean;
    reason?: string;
    totalOrders?: number;
    unhealthyOrders?: number;
    unhealthyRate?: number | null;
    orderNotOnTime?: number;
    orderNotOnTimeRate?: number | null;
    target?: {
      configured: boolean;
      unhealthyRateTarget: number | null;
      status: "IN_TARGET" | "OUT_OF_TARGET" | "NO_TARGET";
    };
    trend?: Array<{
      date: string;
      unhealthyRate: number;
      totalOrders: number;
      unhealthyOrders: number;
    }>;
  };
  branchRanking: {
    available: boolean;
    basis: "UHO_VOLUME_AWARE";
    minOrdersRequired: number;
    reason?: string;
    chain?: ChampBranchRankSummary;
    allBranches?: ChampBranchRankSummary;
  };
  pickerPerformance: {
    available: boolean;
    rows: ChampPickerPerformanceRow[];
    totalRows: number;
    reason?: string;
  };
  recentRequests: {
    available: boolean;
    rows: Array<{
      id: string;
      type: RequestSummary["type"];
      targetUserName: string | null;
      targetShopperId: string | null;
      requestedByName: string;
      status: RequestSummary["status"];
      ageLabel: string;
      createdAt: string;
    }>;
    reason?: string;
  };
}

export interface ChampBranchRankSummary {
  ranked: boolean;
  rank?: number;
  totalEligible: number;
  displayLabel?: string;
  reason?: "NO_KPI_RECORDS" | "LOW_ORDER_VOLUME";
  totalOrders: number;
  unhealthyRate: number | null;
}

export interface ChampPickerPerformanceRow {
  rank: number | null;
  userId: string;
  pickerName: string;
  shopperId: string | null;
  totalOrders: number;
  unhealthyOrders: number;
  unhealthyRate: number | null;
  attendanceHealthRate: number | null;
  issueShifts: number;
  totalShiftErrors: number;
  status: "IN_TARGET" | "WATCH" | "NEEDS_ACTION" | "LOW_VOLUME" | "NO_KPI";
  reasonLabels: string[];
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
    return apiGet<PickerWorkspace>("/workspaces/picker");
  },
  pickerPerformanceSummary(params: {
    dateFrom: string;
    dateTo: string;
    period?: PickerPerformancePeriodLabel;
  }) {
    const query = new URLSearchParams(params);

    return apiGet<PickerPerformanceSummary>(
      `/workspaces/picker/performance-summary?${query}`
    );
  },
  champ() {
    return apiGet<ChampWorkspace>("/workspaces/champ");
  },
  champBranches() {
    return apiGet<ChampBranchesResponse>("/workspaces/champ/branches");
  },
  champBranchDetail(vendorId: string) {
    return apiGet<ChampBranchDetail>(`/workspaces/champ/branches/${vendorId}`);
  },
  champPerformanceSummary(params: {
    dateFrom: string;
    dateTo: string;
    vendorId?: string;
  }) {
    const query = new URLSearchParams({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });

    if (params.vendorId) {
      query.set("vendorId", params.vendorId);
    }

    return apiGet<ChampPerformanceSummary>(
      `/workspaces/champ/performance-summary?${query}`
    );
  },
  areaManager() {
    return apiGet<AreaManagerWorkspace>("/workspaces/area-manager");
  },
  admin() {
    return apiGet<AdminWorkspace>("/workspaces/admin");
  }
};
