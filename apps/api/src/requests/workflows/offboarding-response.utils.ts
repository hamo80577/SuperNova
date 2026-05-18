import { UserRole, type User } from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../../assignments/assignment-response.utils";
import type {
  OffboardingPayload,
  PickerAssignmentWithContext
} from "./offboarding-types";
import type { OffboardingTargetRole } from "./offboarding-workflow.policy";

export function toPickerSearchCard(
  assignment: PickerAssignmentWithContext,
  pendingResignationRequestId: string | null
) {
  return {
    assignmentId: assignment.id,
    assignmentType: "PickerBranchAssignment",
    targetUserId: assignment.pickerId,
    targetRole: UserRole.PICKER,
    pickerId: assignment.pickerId,
    vendorId: assignment.vendorId,
    chainId: assignment.vendor.chainId,
    assignmentStartDate: assignment.startDate,
    pendingResignationRequestId,
    hasPendingResignation: Boolean(pendingResignationRequestId),
    picker: {
      ...toUserSummary(assignment.picker),
      shopperId: assignment.picker.shopperId,
      ibsId: assignment.picker.ibsId,
      joiningDate: assignment.picker.joiningDate,
      blockStatus: assignment.picker.blockStatus
    },
    user: {
      ...toUserSummary(assignment.picker),
      shopperId: assignment.picker.shopperId,
      ibsId: assignment.picker.ibsId,
      joiningDate: assignment.picker.joiningDate,
      blockStatus: assignment.picker.blockStatus
    },
    vendor: toVendorSummary(assignment.vendor),
    chain: toChainSummary(assignment.vendor.chain)
  };
}

export function toEligibleUserSearchCard(params: {
  assignmentId: string;
  assignmentStartDate: Date;
  assignmentType: OffboardingPayload["target"]["assignmentType"];
  chain: ReturnType<typeof toChainSummary>;
  pendingResignationRequestId: string | null;
  role: OffboardingTargetRole;
  user: User;
  vendor?: ReturnType<typeof toVendorSummary>;
}) {
  return {
    assignmentId: params.assignmentId,
    assignmentType: params.assignmentType,
    targetUserId: params.user.id,
    targetRole: params.role,
    userId: params.user.id,
    vendorId: params.vendor?.id,
    chainId: params.chain.id,
    assignmentStartDate: params.assignmentStartDate,
    pendingResignationRequestId: params.pendingResignationRequestId,
    hasPendingResignation: Boolean(params.pendingResignationRequestId),
    role: params.role,
    user: {
      ...toUserSummary(params.user),
      shopperId: params.user.shopperId,
      ibsId: params.user.ibsId,
      joiningDate: params.user.joiningDate,
      blockStatus: params.user.blockStatus
    },
    vendor: params.vendor ?? null,
    chain: params.chain
  };
}

export function toResignedUserResponse(user: User) {
  return {
    id: user.id,
    role: user.role,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    phoneNumber: user.phoneNumber,
    shopperId: user.shopperId,
    ibsId: user.ibsId,
    accountStatus: user.accountStatus,
    employmentStatus: user.employmentStatus,
    profileStatus: user.profileStatus,
    blockStatus: user.blockStatus,
    blockedUntil: user.blockedUntil,
    blockReason: user.blockReason
  };
}

export function formatOffboardingTargetRole(targetRole: OffboardingTargetRole) {
  return targetRole
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
