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

export type AttendanceMatchedRole = "PICKER" | "CHAMP";

export interface AttendanceReportMonth {
  monthKey: string;
  userSummaryCount: number;
  branchSummaryCount: number;
  chainSummaryCount: number;
  dailyRecordsCount: number;
  archiveStatus: string;
  summaryOnly: boolean;
}

export interface AttendanceOverview {
  monthKey: string;
  archiveStatus: string;
  totalPickers: number;
  totalChamps: number;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  totalMissingShifts: number;
  workedShiftCount: number;
  absentCount: number;
  onLeaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  offDayCount: number;
  lateMinutesTotal: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  under8HoursCount: number;
  over15HoursCount: number;
  branchCount: number;
  chainCount: number;
  summaryOnly: boolean;
  dailyRecordsAvailable: boolean;
}

export interface AttendanceChainSummary {
  chainId: string;
  chainName: string;
  branchCount: number;
  pickerCount: number;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  missingShifts: number;
  absentCount: number;
  lateLevel1Over15Count: number;
  under8HoursCount: number;
  over15HoursCount: number;
}

export interface AttendanceBranchSummary {
  vendorId: string;
  vendorName: string;
  vendorExternalId: string | null;
  chainId: string;
  chainName: string;
  pickerCount: number;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  missingShifts: number;
  absentCount: number;
  lateLevel1Over15Count: number;
  under8HoursCount: number;
  over15HoursCount: number;
}

export interface AttendanceUserSummary {
  id: string;
  monthKey: string;
  userId: string;
  displayName: string;
  displayNameAr: string | null;
  identifier: string;
  role: AttendanceMatchedRole;
  branch: {
    id: string;
    vendorName: string;
    vendorExternalId: string | null;
  } | null;
  chain: {
    id: string;
    chainName: string;
  } | null;
  totalCreatedShifts: number;
  totalShiftsNeeded: number;
  missingShifts: number;
  workedShiftCount: number;
  absentCount: number;
  onLeaveCount: number;
  annualLeaveCount: number;
  medicalLeaveCount: number;
  offDayCount: number;
  lateLevel1Over15Count: number;
  lateLevel2From31To45Count: number;
  lateLevel3Over45Count: number;
  under8HoursCount: number;
  over15HoursCount: number;
  sourceDailyRecordsAvailable: boolean;
  archiveStatus: string;
}

export interface AttendanceDailyRecord {
  attendanceDate: string;
  status: string;
  shiftName: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  actualWorkDurationHours: number | null;
  lateMinutes: number;
  lateLevel1Over15: boolean;
  lateLevel2From31To45: boolean;
  lateLevel3Over45: boolean;
  isAbsent: boolean;
  isOnLeave: boolean;
  isAnnualLeave: boolean;
  isMedicalLeave: boolean;
  isOffDay: boolean;
  isUnder8Hours: boolean;
  isOver15Hours: boolean;
  assignmentVendor: {
    id: string;
    vendorName: string;
    vendorExternalId: string | null;
  } | null;
  assignmentChain: {
    id: string;
    chainName: string;
  } | null;
}

interface AttendanceReportQuery {
  chainId?: string;
  monthKey?: string;
  vendorId?: string;
}

interface AttendanceUsersQuery extends AttendanceReportQuery {
  page?: number;
  pageSize?: number;
  role?: AttendanceMatchedRole;
  search?: string;
}

export interface AttendanceUserDailyDetails {
  dailyRecordsAvailable: boolean;
  message: string | null;
  summary: AttendanceUserSummary | null;
  records: AttendanceDailyRecord[];
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
  },
  getAttendanceReportMonths() {
    return apiGet<{ items: AttendanceReportMonth[] }>(
      "/reports/attendance/months"
    );
  },
  getAttendanceOverview(query: AttendanceReportQuery = {}) {
    return apiGet<AttendanceOverview>(
      `/reports/attendance/overview${toQueryString(query)}`
    );
  },
  getAttendanceChainSummaries(query: AttendanceReportQuery = {}) {
    return apiGet<{ monthKey: string; items: AttendanceChainSummary[] }>(
      `/reports/attendance/chains${toQueryString(query)}`
    );
  },
  getAttendanceBranchSummaries(query: AttendanceReportQuery = {}) {
    return apiGet<{ monthKey: string; items: AttendanceBranchSummary[] }>(
      `/reports/attendance/branches${toQueryString(query)}`
    );
  },
  getAttendanceUserSummaries(query: AttendanceUsersQuery = {}) {
    return apiGet<{
      items: AttendanceUserSummary[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }>(`/reports/attendance/users${toQueryString(query)}`);
  },
  getAttendanceUserDailyDetails(userId: string, monthKey: string) {
    return apiGet<AttendanceUserDailyDetails>(
      `/reports/attendance/users/${userId}/daily${toQueryString({ monthKey })}`
    );
  }
};

function toQueryString(query: object) {
  const params = new URLSearchParams();

  (
    Object.entries(query) as Array<[string, string | number | undefined]>
  ).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const value = params.toString();
  return value ? `?${value}` : "";
}
