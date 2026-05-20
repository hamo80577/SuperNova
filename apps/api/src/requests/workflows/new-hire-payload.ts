import { BadRequestException } from "@nestjs/common";
import {
  AccountStatus,
  BlockStatus,
  EmploymentStatus,
  Gender,
  Prisma,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import type { NewHirePayload } from "./new-hire-workflow.types";
import { normalizeNewHireTargetRole } from "./new-hire-workflow.policy";

export function parseNewHirePayload(payload: Prisma.JsonValue): NewHirePayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("New Hire request payload is invalid.");
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidate = objectPayload.candidate;
  const source = objectPayload.source;
  const rehire = objectPayload.rehire;
  const areaManagerDecision = objectPayload.areaManagerDecision;
  const finalization = objectPayload.finalization;
  const targetRole = normalizePayloadTargetRole(
    typeof objectPayload.targetRole === "string"
      ? objectPayload.targetRole
      : undefined
  );

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    throw new BadRequestException("New Hire request payload is incomplete.");
  }

  const candidatePayload = candidate as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const rehirePayload =
    rehire && typeof rehire === "object" && !Array.isArray(rehire)
      ? (rehire as Record<string, unknown>)
      : null;
  const areaManagerPayload =
    areaManagerDecision &&
    typeof areaManagerDecision === "object" &&
    !Array.isArray(areaManagerDecision)
      ? (areaManagerDecision as Record<string, unknown>)
      : null;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;
  const phoneNumber = candidatePayload.phoneNumber;
  const nationalId = candidatePayload.nationalId;
  const vendorId = sourcePayload.vendorId;
  const chainId = sourcePayload.chainId;
  const chainIds = Array.isArray(sourcePayload.chainIds)
    ? sourcePayload.chainIds.filter((value): value is string => typeof value === "string")
    : undefined;
  const candidateGender =
    typeof candidatePayload.gender === "string" &&
    Object.values(Gender).includes(candidatePayload.gender as Gender)
      ? (candidatePayload.gender as Gender)
      : undefined;

  if (typeof phoneNumber !== "string" || typeof nationalId !== "string") {
    throw new BadRequestException("New Hire request payload is missing identity.");
  }

  if (
    targetRole !== UserRole.AREA_MANAGER &&
    (typeof vendorId !== "string" || typeof chainId !== "string")
  ) {
    throw new BadRequestException("New Hire request payload is missing Branch context.");
  }

  const storedMode =
    objectPayload.mode === "REHIRE" ||
    objectPayload.mode === "NEW_CHAMP" ||
    objectPayload.mode === "NEW_AREA_MANAGER" ||
    objectPayload.mode === "NEW_PICKER"
      ? objectPayload.mode
      : targetRole === UserRole.CHAMP
        ? "NEW_CHAMP"
        : targetRole === UserRole.AREA_MANAGER
          ? "NEW_AREA_MANAGER"
          : "NEW_PICKER";

  return {
    targetRole,
    mode: storedMode,
    candidate: {
      nameEn:
        typeof candidatePayload.nameEn === "string"
          ? candidatePayload.nameEn
          : undefined,
      nameAr:
        typeof candidatePayload.nameAr === "string"
          ? candidatePayload.nameAr
          : undefined,
      phoneNumber,
      nationalId,
      address:
        typeof candidatePayload.address === "string"
          ? candidatePayload.address
          : undefined,
      dateOfBirth:
        typeof candidatePayload.dateOfBirth === "string"
          ? candidatePayload.dateOfBirth
          : undefined,
      ...(candidateGender ? { gender: candidateGender } : {}),
      notes:
        typeof candidatePayload.notes === "string"
          ? candidatePayload.notes
          : undefined
    },
    source: {
      ...(typeof vendorId === "string" ? { vendorId } : {}),
      ...(typeof chainId === "string" ? { chainId } : {}),
      ...(chainIds?.length ? { chainIds } : {})
    },
    ...(storedMode === "REHIRE" && rehirePayload
      ? {
          rehire: {
            userId:
              typeof rehirePayload.userId === "string"
                ? rehirePayload.userId
                : "",
            matchedBy: Array.isArray(rehirePayload.matchedBy)
              ? rehirePayload.matchedBy.filter(
                  (value): value is "phoneNumber" | "nationalId" =>
                    value === "phoneNumber" || value === "nationalId"
                )
              : [],
            previousAccountStatus:
              typeof rehirePayload.previousAccountStatus === "string" &&
              Object.values(AccountStatus).includes(
                rehirePayload.previousAccountStatus as AccountStatus
              )
                ? (rehirePayload.previousAccountStatus as AccountStatus)
                : AccountStatus.ARCHIVED,
            previousEmploymentStatus:
              typeof rehirePayload.previousEmploymentStatus === "string" &&
              Object.values(EmploymentStatus).includes(
                rehirePayload.previousEmploymentStatus as EmploymentStatus
              )
                ? (rehirePayload.previousEmploymentStatus as EmploymentStatus)
                : EmploymentStatus.RESIGNED,
            previousBlockStatus:
              typeof rehirePayload.previousBlockStatus === "string" &&
              Object.values(BlockStatus).includes(
                rehirePayload.previousBlockStatus as BlockStatus
              )
                ? (rehirePayload.previousBlockStatus as BlockStatus)
                : BlockStatus.NO_BLOCK,
            previousBlockedUntil:
              typeof rehirePayload.previousBlockedUntil === "string"
                ? rehirePayload.previousBlockedUntil
                : null,
            previousProfileStatus:
              typeof rehirePayload.previousProfileStatus === "string" &&
              Object.values(ProfileStatus).includes(
                rehirePayload.previousProfileStatus as ProfileStatus
              )
                ? (rehirePayload.previousProfileStatus as ProfileStatus)
                : ProfileStatus.INCOMPLETE
          }
        }
      : {}),
    areaManagerDecision: areaManagerPayload
      ? {
          ...(typeof areaManagerPayload.shopperId === "string"
            ? { shopperId: areaManagerPayload.shopperId }
            : {}),
          approvedById:
            typeof areaManagerPayload.approvedById === "string"
              ? areaManagerPayload.approvedById
              : "",
          approvedAt:
            typeof areaManagerPayload.approvedAt === "string"
              ? areaManagerPayload.approvedAt
              : "",
          notes:
            typeof areaManagerPayload.notes === "string"
              ? areaManagerPayload.notes
              : null
        }
      : undefined,
    finalization: finalizationPayload
      ? (finalizationPayload as NewHirePayload["finalization"])
      : undefined
  };
}

function normalizePayloadTargetRole(
  targetRole: UserRole | string | null | undefined
) {
  try {
    return normalizeNewHireTargetRole(targetRole);
  } catch (error) {
    if (error instanceof Error) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }
}
