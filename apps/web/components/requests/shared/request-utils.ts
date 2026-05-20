import { MoveRight, ShieldAlert, UserPlus } from "lucide-react";
import { type NewHireTargetRole, type OffboardingBlockDecision, type RequestSummary, type RequestType, offboardingBlockDecisionLabels } from "@/lib/api/requests";

export type DisplayOffboardingBlockDecision =
  | OffboardingBlockDecision
  | "LEGACY_TEMPORARY_BLOCK";

export function getRequestLoadErrorMessage(caughtError: unknown) {
  const error = caughtError as { message?: string; status?: number } | null;
  const message = error?.message;

  if (
    error?.status === 404 ||
    (message && /not found|no longer available/i.test(message))
  ) {
    return "Request no longer available.";
  }

  return message ?? "Unable to load request.";
}

export function getRequestIcon(type: RequestType) {
  if (type === "NEW_HIRE") return UserPlus;
  if (type === "TRANSFER") return MoveRight;
  if (type === "RESIGNATION") return ShieldAlert;
  return ShieldAlert;
}

export function getRequestPrimaryContext(request: RequestSummary) {
  if (request.type === "NEW_HIRE") {
    const context = parseNewHirePayload(request.payload);
    return {
      title:
        context?.mode === "REHIRE"
          ? `Rehire ${request.targetUser?.nameEn ?? context.candidatePhone}`
          : `${formatEnum(context?.targetRole ?? "PICKER")} New Hire ${context?.candidatePhone ?? ""}`.trim(),
      subtitle:
        context?.targetRole === "AREA_MANAGER"
          ? `${request.sourceChain?.chainName ?? "Selected Chain"} · Area Manager`
          : `${request.sourceVendor?.vendorName ?? "No Branch"} · ${request.sourceChain?.chainName ?? "No Chain"}`
    };
  }

  if (request.type === "TRANSFER") {
    return {
      title: request.targetUser?.nameEn ?? "Picker transfer",
      subtitle: `${request.sourceVendor?.vendorName ?? "Source"} → ${request.destinationVendor?.vendorName ?? "Destination"}`
    };
  }

  return {
    title: request.targetUser?.nameEn ?? formatEnum(request.type),
    subtitle: `Last working day request · ${
      request.sourceVendor?.vendorName ??
      request.sourceChain?.chainName ??
      "No assignment context"
    }`
  };
}

export function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function parseOffboardingPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const offboarding = objectPayload.offboarding;
  const source = objectPayload.source;
  const target = objectPayload.target;
  const areaManagerDecision = objectPayload.areaManagerDecision;
  const finalization = objectPayload.finalization;

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
    return null;
  }

  const offboardingPayload = offboarding as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
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
  const type = offboardingPayload.type;

  if (type !== "RESIGNATION") {
    return null;
  }

  return {
    type,
    reasonCode:
      typeof offboardingPayload.reasonCode === "string"
        ? offboardingPayload.reasonCode
        : "OTHER",
    reason:
      typeof offboardingPayload.reason === "string"
        ? offboardingPayload.reason
        : "Not provided",
    reasonDetails:
      typeof offboardingPayload.reasonDetails === "string"
        ? offboardingPayload.reasonDetails
        : undefined,
    notes:
      typeof offboardingPayload.notes === "string"
        ? offboardingPayload.notes
        : undefined,
    effectiveDate:
      typeof offboardingPayload.resignationDate === "string"
        ? offboardingPayload.resignationDate
        : "Not set",
    sourceVendorId:
      typeof sourcePayload.vendorId === "string"
        ? sourcePayload.vendorId
        : "Not available",
    sourceChainId:
      typeof sourcePayload.chainId === "string"
        ? sourcePayload.chainId
        : "Not available",
    targetRole:
      targetPayload.targetRole === "CHAMP" ||
      targetPayload.targetRole === "AREA_MANAGER" ||
      targetPayload.targetRole === "PICKER"
        ? targetPayload.targetRole
        : "PICKER",
    targetUserId:
      typeof targetPayload.userId === "string"
        ? targetPayload.userId
        : typeof targetPayload.pickerId === "string"
          ? targetPayload.pickerId
          : "Not available",
    assignmentId:
      typeof targetPayload.assignmentId === "string"
        ? targetPayload.assignmentId
        : typeof targetPayload.pickerAssignmentId === "string"
          ? targetPayload.pickerAssignmentId
          : "Not available",
    assignmentType:
      typeof targetPayload.assignmentType === "string"
        ? targetPayload.assignmentType
        : "PickerBranchAssignment",
    pickerId:
      typeof targetPayload.pickerId === "string"
        ? targetPayload.pickerId
        : typeof targetPayload.userId === "string"
          ? targetPayload.userId
          : "Not available",
    pickerAssignmentId:
      typeof targetPayload.pickerAssignmentId === "string"
        ? targetPayload.pickerAssignmentId
        : typeof targetPayload.assignmentId === "string"
          ? targetPayload.assignmentId
          : "Not available",
    areaManagerDecision: areaManagerPayload
      ? {
          blockDecision:
            typeof areaManagerPayload.blockDecision === "string"
              ? parseStoredOffboardingDecision(areaManagerPayload.blockDecision)
              : blockStatusToOffboardingDecision(areaManagerPayload.blockStatus),
          blockStatus:
            typeof areaManagerPayload.blockStatus === "string"
              ? areaManagerPayload.blockStatus
              : "NO_BLOCK",
          blockReason:
            typeof areaManagerPayload.blockReason === "string"
              ? areaManagerPayload.blockReason
              : null
        }
      : null,
    finalizedAt:
      typeof finalizationPayload?.completedAt === "string"
        ? finalizationPayload.completedAt
        : undefined,
    finalization: finalizationPayload
      ? {
          completedAt:
            typeof finalizationPayload.completedAt === "string"
              ? finalizationPayload.completedAt
              : "",
          blockDecision:
            typeof finalizationPayload.blockDecision === "string"
              ? parseStoredOffboardingDecision(finalizationPayload.blockDecision)
              : blockStatusToOffboardingDecision(finalizationPayload.blockStatus),
          blockStatus:
            typeof finalizationPayload.blockStatus === "string"
              ? finalizationPayload.blockStatus
              : "NO_BLOCK",
          blockReason:
            typeof finalizationPayload.blockReason === "string"
              ? finalizationPayload.blockReason
              : null
        }
      : null,
    blockStatus:
      typeof finalizationPayload?.blockStatus === "string"
        ? finalizationPayload.blockStatus
        : undefined
  };
}

export function blockStatusToOffboardingDecision(
  value: unknown
): DisplayOffboardingBlockDecision {
  if (value === "PERMANENT_BLOCK") {
    return "PERMANENT";
  }
  if (value === "TEMPORARY_BLOCK") {
    return "LEGACY_TEMPORARY_BLOCK";
  }
  return "NO_BLOCK";
}

export function formatOffboardingBlockDecision(
  value: DisplayOffboardingBlockDecision | string
) {
  if (value === "LEGACY_TEMPORARY_BLOCK") {
    return "Legacy temporary block";
  }

  return (
    offboardingBlockDecisionLabels[value as OffboardingBlockDecision] ??
    formatEnum(value)
  );
}

function parseStoredOffboardingDecision(
  value: string
): DisplayOffboardingBlockDecision {
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

  return blockStatusToOffboardingDecision(value);
}

export function parseNewHirePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidate = objectPayload.candidate;
  const targetRole = parseNewHireTargetRole(objectPayload.targetRole);
  const mode =
    objectPayload.mode === "REHIRE" ||
    objectPayload.mode === "NEW_PICKER" ||
    objectPayload.mode === "NEW_CHAMP" ||
    objectPayload.mode === "NEW_AREA_MANAGER"
      ? objectPayload.mode
      : targetRole === "CHAMP"
        ? "NEW_CHAMP"
        : targetRole === "AREA_MANAGER"
          ? "NEW_AREA_MANAGER"
          : "NEW_PICKER";
  const rehire = objectPayload.rehire;
  const source = objectPayload.source;
  const areaManagerDecision = objectPayload.areaManagerDecision;
  const finalization = objectPayload.finalization;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    return null;
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
  const chainIds = Array.isArray(sourcePayload.chainIds)
    ? sourcePayload.chainIds.filter((value): value is string => typeof value === "string")
    : undefined;
  const assignmentIds = Array.isArray(finalizationPayload?.assignmentIds)
    ? finalizationPayload.assignmentIds.filter(
        (value): value is string => typeof value === "string"
      )
    : undefined;

  return {
    targetRole,
    mode,
    candidatePhone:
      typeof candidatePayload.phoneNumber === "string"
        ? candidatePayload.phoneNumber
        : "Not available",
    nameEn:
      typeof candidatePayload.nameEn === "string"
        ? candidatePayload.nameEn
        : "Not available",
    nameAr:
      typeof candidatePayload.nameAr === "string" ? candidatePayload.nameAr : undefined,
    nationalId:
      typeof candidatePayload.nationalId === "string"
        ? candidatePayload.nationalId
        : undefined,
    address:
      typeof candidatePayload.address === "string" ? candidatePayload.address : undefined,
    dateOfBirth:
      typeof candidatePayload.dateOfBirth === "string"
        ? candidatePayload.dateOfBirth
        : undefined,
    gender:
      typeof candidatePayload.gender === "string"
        ? candidatePayload.gender
        : "UNSPECIFIED",
    notes:
      typeof candidatePayload.notes === "string" ? candidatePayload.notes : undefined,
    source: {
      vendorId:
        typeof sourcePayload.vendorId === "string" ? sourcePayload.vendorId : undefined,
      chainId:
        typeof sourcePayload.chainId === "string" ? sourcePayload.chainId : undefined,
      chainIds
    },
    rehireUserId:
      typeof rehirePayload?.userId === "string" ? rehirePayload.userId : undefined,
    areaManagerDecision: areaManagerPayload
      ? {
          shopperId:
            typeof areaManagerPayload.shopperId === "string"
              ? areaManagerPayload.shopperId
              : undefined,
          approvedById:
            typeof areaManagerPayload.approvedById === "string"
              ? areaManagerPayload.approvedById
              : undefined,
          approvedAt:
            typeof areaManagerPayload.approvedAt === "string"
              ? areaManagerPayload.approvedAt
              : undefined,
          notes:
            typeof areaManagerPayload.notes === "string"
              ? areaManagerPayload.notes
              : null
        }
      : null,
    finalization: finalizationPayload
      ? {
          userId:
            typeof finalizationPayload.userId === "string"
              ? finalizationPayload.userId
              : typeof finalizationPayload.pickerId === "string"
                ? finalizationPayload.pickerId
                : "Not available",
          assignmentId:
            typeof finalizationPayload.assignmentId === "string"
              ? finalizationPayload.assignmentId
              : undefined,
          assignmentIds,
          assignmentType:
            typeof finalizationPayload.assignmentType === "string"
              ? finalizationPayload.assignmentType
              : undefined,
          shopperId:
            typeof finalizationPayload.shopperId === "string"
              ? finalizationPayload.shopperId
              : undefined,
          completedAt:
            typeof finalizationPayload.completedAt === "string"
              ? finalizationPayload.completedAt
              : undefined
        }
      : null
  };
}

export function parseNewHireTargetRole(value: unknown): NewHireTargetRole {
  return value === "CHAMP" || value === "AREA_MANAGER" || value === "PICKER"
    ? value
    : "PICKER";
}

export function parseTransferPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  const transfer = objectPayload.transfer;
  const source = objectPayload.source;
  const destination = objectPayload.destination;
  const target = objectPayload.target;
  const finalization = objectPayload.finalization;

  if (
    !transfer ||
    typeof transfer !== "object" ||
    Array.isArray(transfer) ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    !destination ||
    typeof destination !== "object" ||
    Array.isArray(destination) ||
    !target ||
    typeof target !== "object" ||
    Array.isArray(target)
  ) {
    return null;
  }

  const transferPayload = transfer as Record<string, unknown>;
  const sourcePayload = source as Record<string, unknown>;
  const destinationPayload = destination as Record<string, unknown>;
  const targetPayload = target as Record<string, unknown>;
  const finalizationPayload =
    finalization && typeof finalization === "object" && !Array.isArray(finalization)
      ? (finalization as Record<string, unknown>)
      : null;
  const approvalPath = transferPayload.approvalPath;

  if (approvalPath !== "SAME_CHAIN" && approvalPath !== "CROSS_CHAIN") {
    return null;
  }

  return {
    approvalPath,
    reason:
      typeof transferPayload.reason === "string"
        ? transferPayload.reason
        : "Not provided",
    notes:
      typeof transferPayload.notes === "string"
        ? transferPayload.notes
        : undefined,
    requestedTransferDate:
      typeof transferPayload.requestedTransferDate === "string"
        ? transferPayload.requestedTransferDate
        : undefined,
    sourceVendorId:
      typeof sourcePayload.vendorId === "string"
        ? sourcePayload.vendorId
        : "Not available",
    sourceChainId:
      typeof sourcePayload.chainId === "string"
        ? sourcePayload.chainId
        : "Not available",
    destinationVendorId:
      typeof destinationPayload.vendorId === "string"
        ? destinationPayload.vendorId
        : "Not available",
    destinationChainId:
      typeof destinationPayload.chainId === "string"
        ? destinationPayload.chainId
        : "Not available",
    pickerId:
      typeof targetPayload.pickerId === "string"
        ? targetPayload.pickerId
        : "Not available",
    completedAt:
      typeof finalizationPayload?.completedAt === "string"
        ? finalizationPayload.completedAt
        : undefined,
    oldAssignmentId:
      typeof finalizationPayload?.oldAssignmentId === "string"
        ? finalizationPayload.oldAssignmentId
        : "Not available",
    newAssignmentId:
      typeof finalizationPayload?.newAssignmentId === "string"
        ? finalizationPayload.newAssignmentId
        : "Not available"
  };
}

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
