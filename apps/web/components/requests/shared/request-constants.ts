import { type OffboardingBlockDecision, type OffboardingReasonCode, type RequestStatus, type RequestType } from "@/lib/api/requests";

export const requestTypes: RequestType[] = [
  "NEW_HIRE",
  "RESIGNATION",
  "TRANSFER"
];

export const offboardingReasonCodes: OffboardingReasonCode[] = [
  "BAD_ATTITUDE",
  "BAD_PERFORMANCE",
  "ATTENDANCE_ISSUES",
  "POLICY_VIOLATION",
  "NO_SHOW",
  "VOLUNTARY_QUIT",
  "OTHER"
];

export const offboardingBlockDecisions: OffboardingBlockDecision[] = [
  "NO_BLOCK",
  "PERMANENT"
];

export const internalRequestEngineTypes: RequestType[] = [];

export const requestStatuses: RequestStatus[] = [
  "DRAFT",
  "PENDING_AREA_MANAGER",
  "PENDING_DESTINATION_AREA_MANAGER",
  "PENDING_ADMIN",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED"
];
