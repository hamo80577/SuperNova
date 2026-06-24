import type {
  AccountStatus,
  BlockStatus,
  Chain,
  EmploymentStatus,
  Gender,
  Prisma,
  ProfileStatus,
  User,
  UserRole,
  Vendor
} from "@prisma/client";

import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import type { GeneratedApprovalStep } from "../request-approval-routing.service";
import type {
  NewHireCandidateDecision,
  NewHireTargetRole
} from "./new-hire-workflow.policy";

type CandidateUserInclude = {
  pickerBranchAssignments: {
    include: { vendor: { include: { chain: true } } };
    orderBy: { startDate: "desc" };
    take: 5;
  };
  vendorChampAssignments: {
    include: { vendor: { include: { chain: true } } };
    orderBy: { startDate: "desc" };
    take: 5;
  };
  chainAreaManagerAssignments: {
    include: { chain: true };
    orderBy: { startDate: "desc" };
    take: 5;
  };
};

export type CandidateUser = Prisma.UserGetPayload<{
  include: CandidateUserInclude;
}>;

export type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type NewHireMode =
  | "NEW_PICKER"
  | "NEW_CHAMP"
  | "NEW_AREA_MANAGER"
  | "REHIRE";

export type NewHirePayload = {
  targetRole: NewHireTargetRole;
  mode: NewHireMode;
  candidate: {
    firstNameEn?: string;
    secondNameEn?: string;
    thirdNameEn?: string;
    nameEn?: string;
    nameAr?: string;
    phoneNumber: string;
    nationalId: string;
    address?: string;
    actualJoiningDate?: string;
    dateOfBirth?: string;
    gender?: Gender;
    notes?: string;
  };
  source: {
    vendorId?: string;
    chainId?: string;
    chainIds?: string[];
  };
  rehire?: {
    userId: string;
    matchedBy: Array<"phoneNumber" | "nationalId">;
    previousAccountStatus: AccountStatus;
    previousEmploymentStatus: EmploymentStatus;
    previousBlockStatus: BlockStatus;
    previousBlockedUntil?: string | null;
    previousProfileStatus: ProfileStatus;
  };
  areaManagerDecision?: {
    shopperId?: string;
    approvedById: string;
    approvedAt: string;
    notes?: string | null;
  };
  finalization?: {
    userId: string;
    assignmentId?: string;
    assignmentIds?: string[];
    assignmentType?:
      | "PickerBranchAssignment"
      | "VendorChampAssignment";
    shopperId?: string;
    completedAt: string;
  };
};

export type NormalizedNewHireCandidate = NewHirePayload["candidate"];

export type BranchNewHireContext = {
  targetRole: Extract<UserRole, "PICKER" | "CHAMP">;
  sourceVendor: Vendor & { chain: Chain };
  areaManagerStep: GeneratedApprovalStep;
  skipAreaManagerApproval: boolean;
  areaManagerCapturedShopperId?: string;
};

export type AreaManagerNewHireContext = {
  targetRole: Extract<UserRole, "AREA_MANAGER">;
};

export type NewHireCandidateMatch = {
  user: CandidateUser;
  matchedBy: Array<"phoneNumber" | "nationalId">;
  decision: NewHireCandidateDecision;
  reason?: string;
  blockedUntil?: string | null;
  remainingDays?: number | null;
};

export type FinalizedAssignment =
  | Prisma.PickerBranchAssignmentGetPayload<Record<string, never>>
  | Prisma.VendorChampAssignmentGetPayload<Record<string, never>>;

export type NewHireUserProfileFields = {
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  nationalId: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender;
  shopperId: string | null;
  joiningDate: Date;
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
  passwordHash: string;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date;
  temporaryPasswordCiphertext: string;
  temporaryPasswordCreatedAt: Date;
};

export type ExistingNewHireUser = User;
