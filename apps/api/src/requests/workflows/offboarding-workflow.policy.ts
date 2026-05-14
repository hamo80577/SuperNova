import { BadRequestException } from "@nestjs/common";
import { BlockStatus, RequestType } from "@prisma/client";

export type OffboardingReasonCode =
  | "BAD_ATTITUDE"
  | "BAD_PERFORMANCE"
  | "ATTENDANCE_ISSUES"
  | "POLICY_VIOLATION"
  | "NO_SHOW"
  | "VOLUNTARY_QUIT"
  | "OTHER";

export type OffboardingBlockDecision =
  | "NO_BLOCK"
  | "THREE_MONTHS"
  | "SIX_MONTHS"
  | "ONE_YEAR"
  | "PERMANENT";

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
  "THREE_MONTHS",
  "SIX_MONTHS",
  "ONE_YEAR",
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

export function normalizeOffboardingReason(dto: {
  type: RequestType;
  reasonCode?: string;
  reasonDetails?: string;
  resignationDate?: string;
  notes?: string;
}) {
  if (dto.type !== RequestType.RESIGNATION) {
    throw new BadRequestException("Only RESIGNATION requests are supported.");
  }

  const reasonCode = dto.reasonCode?.trim() as OffboardingReasonCode | undefined;
  const reasonDetails = dto.reasonDetails?.trim();
  const resignationDate = dto.resignationDate?.trim();
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
    ...(notes ? { notes } : {})
  };
}

export function normalizeOffboardingBlockDecision(dto: {
  blockDecision?: string;
  blockReason?: string;
  notes?: string;
}) {
  const blockDecision = (dto.blockDecision?.trim() ||
    "NO_BLOCK") as OffboardingBlockDecision;
  const blockReason = dto.blockReason?.trim() || null;
  const notes = dto.notes?.trim();

  if (!blockDecisions.has(blockDecision)) {
    throw new BadRequestException("blockDecision is invalid.");
  }

  if (blockDecision !== "NO_BLOCK" && !blockReason) {
    throw new BadRequestException(
      "blockReason is required for all block decisions except NO_BLOCK."
    );
  }

  return {
    blockDecision,
    blockStatus: toBlockStatus(blockDecision),
    blockReason: blockDecision === "NO_BLOCK" ? null : blockReason,
    ...(notes ? { notes } : {})
  };
}

export function calculateBlockedUntil(
  blockDecision: OffboardingBlockDecision,
  from = new Date()
) {
  if (blockDecision === "NO_BLOCK" || blockDecision === "PERMANENT") {
    return null;
  }

  const blockedUntil = new Date(from);

  if (blockDecision === "THREE_MONTHS") {
    blockedUntil.setUTCMonth(blockedUntil.getUTCMonth() + 3);
  } else if (blockDecision === "SIX_MONTHS") {
    blockedUntil.setUTCMonth(blockedUntil.getUTCMonth() + 6);
  } else {
    blockedUntil.setUTCFullYear(blockedUntil.getUTCFullYear() + 1);
  }

  return blockedUntil;
}

function toBlockStatus(blockDecision: OffboardingBlockDecision) {
  if (blockDecision === "NO_BLOCK") {
    return BlockStatus.NO_BLOCK;
  }

  if (blockDecision === "PERMANENT") {
    return BlockStatus.PERMANENT_BLOCK;
  }

  return BlockStatus.TEMPORARY_BLOCK;
}
