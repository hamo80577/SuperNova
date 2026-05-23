import {
  BlockStatus,
  Prisma,
  RequestStatus,
  type User
} from "@prisma/client";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import type {
  OffboardingReasonCode,
  StoredOffboardingBlockDecision,
  OffboardingTargetRole
} from "./offboarding-workflow.policy";

export const pickerAssignmentInclude = {
  picker: true,
  vendor: { include: { chain: true } }
} satisfies Prisma.PickerBranchAssignmentInclude;

export type PickerAssignmentWithContext =
  Prisma.PickerBranchAssignmentGetPayload<{
    include: typeof pickerAssignmentInclude;
  }>;

export const champAssignmentInclude = {
  champ: true,
  vendor: { include: { chain: true } }
} satisfies Prisma.VendorChampAssignmentInclude;

export type ChampAssignmentWithContext =
  Prisma.VendorChampAssignmentGetPayload<{
    include: typeof champAssignmentInclude;
  }>;

export const areaManagerAssignmentInclude = {
  areaManager: true,
  chain: true
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

export type AreaManagerAssignmentWithContext =
  Prisma.ChainAreaManagerAssignmentGetPayload<{
    include: typeof areaManagerAssignmentInclude;
  }>;

export type OffboardingRequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type OffboardingAssignmentType =
  | "PickerBranchAssignment"
  | "VendorChampAssignment"
  | "ChainAreaManagerAssignment";

export type OffboardingPayload = {
  offboarding: {
    type: "RESIGNATION";
    reasonCode: OffboardingReasonCode;
    reason: string;
    reasonDetails?: string;
    notes?: string;
    resignationDate: string;
    lastWorkingDate?: string;
  };
  source: {
    vendorId?: string;
    chainId: string;
  };
  target: {
    userId: string;
    targetRole: OffboardingTargetRole;
    assignmentId: string;
    assignmentType: OffboardingAssignmentType;
  };
  areaManagerDecision?: {
    decidedAt: string;
    decidedById: string;
    blockDecision: StoredOffboardingBlockDecision;
    blockStatus: BlockStatus;
    blockReason: string | null;
    notes?: string;
  };
  finalization?: {
    completedAt: string;
    assignmentId: string;
    assignmentIds?: string[];
    blockDecision: StoredOffboardingBlockDecision;
    blockStatus: BlockStatus;
    blockReason?: string | null;
    finalizedById: string;
    notes?: string;
  };
};

export type ResignationTargetContext = {
  assignmentId: string;
  assignmentType: OffboardingAssignmentType;
  sourceChainId: string;
  sourceVendorId?: string;
  sourceLabel: string;
  targetUser: User;
  targetRole: OffboardingTargetRole;
};

export const openRequestStatuses = [
  RequestStatus.DRAFT,
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN,
  RequestStatus.APPROVED
];
