import { UserRole } from "@prisma/client";

export const DASHBOARD_CACHE_QUEUE = "dashboard-cache";
export const DASHBOARD_CACHE_BULK_JOB = "dashboard-cache.bulk";
export const DASHBOARD_CACHE_TARGETED_JOB = "dashboard-cache.targeted";

export const IMPORT_ATTENDANCE_SUCCESS_EVENT = "import.attendance.success";
export const IMPORT_KPI_SUCCESS_EVENT = "import.kpi.success";
export const USER_METRICS_UPDATED_EVENT = "user.metrics.updated";

export const DASHBOARD_CACHE_DEFAULT_TTL_SECONDS = 15 * 60;
export const DASHBOARD_CACHE_DEFAULT_BULK_CHUNK_SIZE = 100;
export const DASHBOARD_CACHE_DEFAULT_CALCULATION_CONCURRENCY = 5;

export const DASHBOARD_CACHEABLE_ROLES = [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
] as const;

export const DASHBOARD_CACHE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: 100,
  removeOnFail: 500
};
