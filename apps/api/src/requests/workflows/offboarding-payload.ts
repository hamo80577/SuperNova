import { BadRequestException } from "@nestjs/common";
import { BlockStatus, Prisma, RequestType, UserRole } from "@prisma/client";

import {
  normalizeOffboardingTargetRole,
  type StoredOffboardingBlockDecision,
  type OffboardingReasonCode
} from "./offboarding-workflow.policy";
import type { OffboardingPayload } from "./offboarding-types";
import { normalizeOptionalDateOnly } from "./request-date";

export function parseOffboardingPayload(
  payload: Prisma.JsonValue
): OffboardingPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Resignation request payload is invalid.");
  }

  const objectPayload = payload as Record<string, unknown>;
  const offboarding = objectPayload.offboarding;
  const source = objectPayload.source;
  const target = objectPayload.target;

  if (
    !offboarding ||
    typeof offboarding !== "object" ||
    Array.isArray(offboarding) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    !target ||
    typeof target !== "object" ||
    Array.isArray(target)
  ) {
    throw new BadRequestException("Resignation request payload is incomplete.");
  }

  const offboardingPayload = offboarding as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
  const type = offboardingPayload.type;
  const reason = offboardingPayload.reason;
  const reasonCode =
    typeof offboardingPayload.reasonCode === "string"
      ? offboardingPayload.reasonCode
      : "OTHER";
  const resignationDate = offboardingPayload.resignationDate;
  const vendorId = sourcePayload.vendorId;
  const chainId = sourcePayload.chainId;
  const targetRole = normalizeOffboardingTargetRole(
    typeof targetPayload.targetRole === "string"
      ? targetPayload.targetRole
      : undefined
  );
  const lastWorkingDate =
    targetRole === UserRole.PICKER
      ? normalizeOptionalDateOnly(
          typeof offboardingPayload.lastWorkingDate === "string"
            ? offboardingPayload.lastWorkingDate
            : undefined,
          "lastWorkingDate"
        )
      : undefined;
  const userId =
    typeof targetPayload.userId === "string"
      ? targetPayload.userId
      : typeof targetPayload.pickerId === "string"
        ? targetPayload.pickerId
        : undefined;
  const assignmentId =
    typeof targetPayload.assignmentId === "string"
      ? targetPayload.assignmentId
      : typeof targetPayload.pickerAssignmentId === "string"
        ? targetPayload.pickerAssignmentId
        : undefined;
  const assignmentType =
    typeof targetPayload.assignmentType === "string"
      ? targetPayload.assignmentType
      : "PickerBranchAssignment";

  if (
    type !== RequestType.RESIGNATION ||
    typeof reason !== "string" ||
    typeof resignationDate !== "string" ||
    typeof chainId !== "string" ||
    typeof userId !== "string" ||
    typeof assignmentId !== "string"
  ) {
    throw new BadRequestException(
      "Resignation request payload is missing required context."
    );
  }

  if (
    (targetRole === UserRole.PICKER &&
      (assignmentType !== "PickerBranchAssignment" ||
        typeof vendorId !== "string")) ||
    (targetRole === UserRole.CHAMP &&
      (assignmentType !== "VendorChampAssignment" ||
        typeof vendorId !== "string")) ||
    (targetRole === UserRole.AREA_MANAGER &&
      assignmentType !== "ChainAreaManagerAssignment")
  ) {
    throw new BadRequestException(
      "Resignation request payload has invalid assignment context."
    );
  }

  return {
    offboarding: {
      type,
      reasonCode: reasonCode as OffboardingReasonCode,
      reason,
      reasonDetails:
        typeof offboardingPayload.reasonDetails === "string"
          ? offboardingPayload.reasonDetails
          : undefined,
      notes:
        typeof offboardingPayload.notes === "string"
          ? offboardingPayload.notes
          : undefined,
      resignationDate,
      ...(lastWorkingDate ? { lastWorkingDate } : {})
    },
    source: {
      ...(typeof vendorId === "string" ? { vendorId } : {}),
      chainId
    },
    target: {
      userId,
      targetRole,
      assignmentId,
      assignmentType: assignmentType as OffboardingPayload["target"]["assignmentType"]
    },
    areaManagerDecision: parseStoredBlockDecision(
      objectPayload.areaManagerDecision
    ),
    finalization:
      objectPayload.finalization &&
      typeof objectPayload.finalization === "object" &&
      !Array.isArray(objectPayload.finalization)
        ? (objectPayload.finalization as OffboardingPayload["finalization"])
        : undefined
  };
}

export function parseStoredBlockDecision(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const blockDecision =
    typeof payload.blockDecision === "string"
      ? normalizeStoredBlockDecision(payload.blockDecision)
      : blockStatusToDecision(payload.blockStatus);

  if (!blockDecision || typeof payload.blockStatus !== "string") {
    return undefined;
  }

  return {
    decidedAt:
      typeof payload.decidedAt === "string"
        ? payload.decidedAt
        : new Date(0).toISOString(),
    decidedById:
      typeof payload.decidedById === "string" ? payload.decidedById : "",
    blockDecision,
    blockStatus: payload.blockStatus as BlockStatus,
    blockReason:
      typeof payload.blockReason === "string" ? payload.blockReason : null,
    notes: typeof payload.notes === "string" ? payload.notes : undefined
  };
}

export function blockStatusToDecision(value: unknown) {
  if (value === BlockStatus.NO_BLOCK) return "NO_BLOCK";
  if (value === BlockStatus.PERMANENT_BLOCK) return "PERMANENT";
  if (value === BlockStatus.TEMPORARY_BLOCK) return "LEGACY_TEMPORARY_BLOCK";
  return null;
}

function normalizeStoredBlockDecision(
  value: string
): StoredOffboardingBlockDecision | null {
  if (value === "NO_BLOCK" || value === "PERMANENT") {
    return value;
  }

  if (
    value === "THREE_MONTHS" ||
    value === "SIX_MONTHS" ||
    value === "ONE_YEAR" ||
    value === "LEGACY_TEMPORARY_BLOCK"
  ) {
    return "LEGACY_TEMPORARY_BLOCK";
  }

  return null;
}
