import { BlockStatus, UserRole } from "@prisma/client";

export type NewHireTargetRole =
  | Extract<UserRole, "PICKER">
  | Extract<UserRole, "CHAMP">
  | Extract<UserRole, "AREA_MANAGER">;

export type NewHireLookupStatus =
  | "CLEAR"
  | "ACTIVE_DUPLICATE"
  | "REHIRE_AVAILABLE"
  | "TEMPORARY_BLOCKED"
  | "PERMANENT_BLOCKED";

export type NewHireCandidateDecision = Exclude<NewHireLookupStatus, "CLEAR">;

const TARGET_ROLES = new Set<UserRole>([
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
]);

const ADMIN_LIFECYCLE_TARGET_ROLES: NewHireTargetRole[] = [
  UserRole.PICKER,
  UserRole.CHAMP,
  UserRole.AREA_MANAGER
];

export function normalizeNewHireTargetRole(
  targetRole: UserRole | string | null | undefined
): NewHireTargetRole {
  const normalized = targetRole ?? UserRole.PICKER;

  if (TARGET_ROLES.has(normalized as UserRole)) {
    return normalized as NewHireTargetRole;
  }

  throw new Error("targetRole must be PICKER, CHAMP, or AREA_MANAGER.");
}

export function getAllowedNewHireTargetRolesForCreator(
  creatorRole: UserRole
): NewHireTargetRole[] {
  if (creatorRole === UserRole.CHAMP) {
    return [UserRole.PICKER];
  }

  if (creatorRole === UserRole.AREA_MANAGER) {
    return [UserRole.PICKER, UserRole.CHAMP];
  }

  if (creatorRole === UserRole.ADMIN || creatorRole === UserRole.SUPER_ADMIN) {
    return ADMIN_LIFECYCLE_TARGET_ROLES;
  }

  return [];
}

export function validateEgyptPhoneNumber(value: string | null | undefined) {
  const phoneNumber = value?.trim() ?? "";

  if (!phoneNumber) {
    throw new Error("phoneNumber is required.");
  }

  if (!/^\d+$/.test(phoneNumber)) {
    throw new Error("phoneNumber must contain numbers only.");
  }

  if (phoneNumber.length !== 11) {
    throw new Error("phoneNumber must be exactly 11 digits.");
  }

  if (!/^(010|011|012|015)/.test(phoneNumber)) {
    throw new Error("phoneNumber must start with 010, 011, 012, or 015.");
  }

  return phoneNumber;
}

export function validateEgyptNationalId(value: string | null | undefined) {
  const nationalId = value?.trim() ?? "";

  if (!nationalId) {
    throw new Error("nationalId is required.");
  }

  if (!/^\d+$/.test(nationalId)) {
    throw new Error("nationalId must contain numbers only.");
  }

  if (nationalId.length !== 14) {
    throw new Error("nationalId must be exactly 14 digits.");
  }

  return nationalId;
}

export function toNewHireLookupStatus(
  decisions: NewHireCandidateDecision[]
): NewHireLookupStatus {
  if (decisions.includes("PERMANENT_BLOCKED")) {
    return "PERMANENT_BLOCKED";
  }

  if (decisions.includes("TEMPORARY_BLOCKED")) {
    return "TEMPORARY_BLOCKED";
  }

  if (decisions.includes("ACTIVE_DUPLICATE")) {
    return "ACTIVE_DUPLICATE";
  }

  if (decisions.includes("REHIRE_AVAILABLE")) {
    return "REHIRE_AVAILABLE";
  }

  return "CLEAR";
}

export function resolveNewHireFinalizationShopperId(
  targetRole: NewHireTargetRole,
  requestedShopperId: string | null | undefined,
  existingShopperId: string | null | undefined
) {
  if (targetRole !== UserRole.PICKER) {
    return null;
  }

  const requested = requestedShopperId?.trim();
  if (requested) {
    return requested;
  }

  const existing = existingShopperId?.trim();
  if (existing) {
    return existing;
  }

  throw new Error("Shopper ID is required for Picker New Hire.");
}

export function getRehireBlockNormalizationFields() {
  return {
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null
  };
}
