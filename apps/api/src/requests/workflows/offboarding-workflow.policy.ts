import { BadRequestException } from "@nestjs/common";
import { BlockStatus, RequestType, UserRole } from "@prisma/client";

import { normalizeRequiredDateOnly } from "./request-date";

export type OffboardingReasonCode =
  | "BAD_ATTITUDE"
  | "BAD_PERFORMANCE"
  | "ATTENDANCE_ISSUES"
  | "POLICY_VIOLATION"
  | "NO_SHOW"
  | "VOLUNTARY_QUIT"
  | "OTHER";

export type OffboardingBlockDecision = "NO_BLOCK" | "PERMANENT";
export type StoredOffboardingBlockDecision =
  | OffboardingBlockDecision
  | "LEGACY_TEMPORARY_BLOCK";
export type OffboardingTargetRole =
  | Extract<UserRole, "PICKER">
  | Extract<UserRole, "CHAMP">
  | Extract<UserRole, "AREA_MANAGER">;

export const OFFBOARDING_REASON_CODES: OffboardingReasonCode[] = [
  "BAD_ATTITUDE",
  "BAD_PERFORMANCE",
  "ATTENDANCE_ISSUES",
  "POLICY_VIOLATION",
  "NO_SHOW",
  "VOLUNTARY_QUIT",
  "OTHER"
];

export const OFFBOARDING_BLOCK_DECISIONS: OffboardingBlockDecision[] = [
  "NO_BLOCK",
  "PERMANENT"
];

export const offboardingReasonLabels: Record<OffboardingReasonCode, string> = {
  BAD_ATTITUDE: "Bad attitude",
  BAD_PERFORMANCE: "Bad performance",
  ATTENDANCE_ISSUES: "Attendance issues",
  POLICY_VIOLATION: "Policy violation",
  NO_SHOW: "No show",
  VOLUNTARY_QUIT: "Voluntary quit",
  OTHER: "Other"
};

const reasonCodes = new Set<string>(OFFBOARDING_REASON_CODES);
const blockDecisions = new Set<string>(OFFBOARDING_BLOCK_DECISIONS);
const legacyTemporaryBlockDecisions = new Set<string>([
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR"
]);
const targetRoles = new Set<UserRole>([
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);
const ADMIN_RESIGNATION_TARGET_ROLES: OffboardingTargetRole[] = [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
];

export function normalizeOffboardingTargetRole(
  targetRole: UserRole | string | null | undefined
): OffboardingTargetRole {
  const normalized = targetRole ?? UserRole.PICKER;

  if (targetRoles.has(normalized as UserRole)) {
    return normalized as OffboardingTargetRole;
  }

  throw new BadRequestException("targetRole must be PICKER, CHAMP, or AREA_MANAGER.");
}

export function getAllowedResignationTargetRolesForCreator(
  creatorRole: UserRole
): OffboardingTargetRole[] {
  if (creatorRole === UserRole.CHAMP) {
    return [UserRole.PICKER];
  }

  if (creatorRole === UserRole.AREA_MANAGER) {
    return [UserRole.PICKER, UserRole.CHAMP];
  }

  if (creatorRole === UserRole.ADMIN || creatorRole === UserRole.SUPER_ADMIN) {
    return ADMIN_RESIGNATION_TARGET_ROLES;
  }

  return [];
}

export function normalizeOffboardingReason(dto: {
  type: RequestType;
  reasonCode?: string;
  reasonDetails?: string;
  resignationDate?: string;
  lastWorkingDate?: string;
  notes?: string;
}, targetRole?: OffboardingTargetRole) {
  if (dto.type !== RequestType.RESIGNATION) {
    throw new BadRequestException("Only RESIGNATION requests are supported.");
  }

  const reasonCode = dto.reasonCode?.trim() as OffboardingReasonCode | undefined;
  const reasonDetails = dto.reasonDetails?.trim();
  const resignationDate = dto.resignationDate?.trim();
  const lastWorkingDate =
    targetRole === UserRole.PICKER
      ? normalizeRequiredDateOnly(
          dto.lastWorkingDate,
          "lastWorkingDate",
          "lastWorkingDate is required for Picker Resignation."
        )
      : undefined;
  const notes = dto.notes?.trim();

  if (!reasonCode || !reasonCodes.has(reasonCode)) {
    throw new BadRequestException("reasonCode is required.");
  }

  if (!resignationDate) {
    throw new BadRequestException("resignationDate is required.");
  }

  if (reasonCode === "OTHER" && !reasonDetails) {
    throw new BadRequestException(
      "reasonDetails is required when reasonCode is OTHER."
    );
  }

  return {
    type: "RESIGNATION" as const,
    reasonCode,
    reason: offboardingReasonLabels[reasonCode],
    ...(reasonDetails ? { reasonDetails } : {}),
    resignationDate,
    ...(lastWorkingDate ? { lastWorkingDate } : {}),
    ...(notes ? { notes } : {})
  };
}

export function normalizeOffboardingBlockDecision(dto: {
  blockDecision?: string;
  blockReason?: string;
  notes?: string;
}) {
  const rawBlockDecision = dto.blockDecision?.trim() || "NO_BLOCK";
  const blockReason = dto.blockReason?.trim() || null;
  const notes = dto.notes?.trim();

  if (legacyTemporaryBlockDecisions.has(rawBlockDecision)) {
    throw new BadRequestException(
      "Temporary block durations are no longer supported for Resignation."
    );
  }

  if (!blockDecisions.has(rawBlockDecision)) {
    throw new BadRequestException("blockDecision is invalid.");
  }

  const blockDecision = rawBlockDecision as OffboardingBlockDecision;

  if (blockDecision === "PERMANENT" && !blockReason) {
    throw new BadRequestException(
      "blockReason is required for PERMANENT block."
    );
  }

  return {
    blockDecision,
    blockStatus: toBlockStatus(blockDecision),
    blockReason: blockDecision === "NO_BLOCK" ? null : blockReason,
    ...(notes ? { notes } : {})
  };
}

function toBlockStatus(blockDecision: OffboardingBlockDecision) {
  if (blockDecision === "NO_BLOCK") {
    return BlockStatus.NO_BLOCK;
  }

  return BlockStatus.PERMANENT_BLOCK;
}
