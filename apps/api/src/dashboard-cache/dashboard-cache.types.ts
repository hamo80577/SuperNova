import type { UserRole } from "@prisma/client";

export type DashboardCacheBulkSource =
  | "ATTENDANCE_IMPORT"
  | "KPI_IMPORT";

export type DashboardCacheTargetedSource = "DEDUCTION" | "ANNUAL_LEAVE";

export interface DashboardCacheBulkEvent {
  eventId: string;
  months: string[];
  source: DashboardCacheBulkSource;
}

export interface DashboardCacheTargetedEvent {
  eventId: string;
  userId: string;
  month: string;
  source: DashboardCacheTargetedSource;
}

export interface DashboardCacheBulkJobData extends DashboardCacheBulkEvent {
  kind: "BULK";
}

export interface DashboardCacheTargetedJobData
  extends DashboardCacheTargetedEvent {
  kind: "TARGETED";
}

export type DashboardCacheJobData =
  | DashboardCacheBulkJobData
  | DashboardCacheTargetedJobData;

export interface DashboardCacheWriteEntry {
  role: UserRole;
  userId: string;
  month: string;
  summary: unknown;
}

export interface DashboardPerformanceQuery {
  dateFrom: string;
  dateTo: string;
  period?: string;
  vendorId?: string;
  chainId?: string;
}
