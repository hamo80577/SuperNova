import { ApprovalStep } from "@prisma/client";

export const ApprovalAuthorities = {
  CHAIN_AUTHORITY_APPROVAL: "CHAIN_AUTHORITY_APPROVAL",
  SOURCE_CHAIN_AUTHORITY_APPROVAL: "SOURCE_CHAIN_AUTHORITY_APPROVAL",
  DESTINATION_CHAIN_AUTHORITY_APPROVAL: "DESTINATION_CHAIN_AUTHORITY_APPROVAL",
  FINAL_LIFECYCLE_AUTHORITY: "FINAL_LIFECYCLE_AUTHORITY"
} as const;

export type ApprovalAuthority =
  (typeof ApprovalAuthorities)[keyof typeof ApprovalAuthorities];

export const APPROVAL_AUTHORITIES = [
  ApprovalAuthorities.CHAIN_AUTHORITY_APPROVAL,
  ApprovalAuthorities.SOURCE_CHAIN_AUTHORITY_APPROVAL,
  ApprovalAuthorities.DESTINATION_CHAIN_AUTHORITY_APPROVAL,
  ApprovalAuthorities.FINAL_LIFECYCLE_AUTHORITY
] as const satisfies readonly ApprovalAuthority[];

export const APPROVAL_AUTHORITY_BY_STEP = {
  [ApprovalStep.AREA_MANAGER_APPROVAL]:
    ApprovalAuthorities.CHAIN_AUTHORITY_APPROVAL,
  [ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL]:
    ApprovalAuthorities.SOURCE_CHAIN_AUTHORITY_APPROVAL,
  [ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL]:
    ApprovalAuthorities.DESTINATION_CHAIN_AUTHORITY_APPROVAL,
  [ApprovalStep.ADMIN_FINAL_APPROVAL]:
    ApprovalAuthorities.FINAL_LIFECYCLE_AUTHORITY
} as const satisfies Readonly<Record<ApprovalStep, ApprovalAuthority>>;

export function getApprovalAuthorityForStep(
  step: ApprovalStep
): ApprovalAuthority {
  return APPROVAL_AUTHORITY_BY_STEP[step];
}

export function isChainAuthorityStep(step: ApprovalStep): boolean {
  const authority = getApprovalAuthorityForStep(step);

  return (
    authority === ApprovalAuthorities.CHAIN_AUTHORITY_APPROVAL ||
    authority === ApprovalAuthorities.SOURCE_CHAIN_AUTHORITY_APPROVAL ||
    authority === ApprovalAuthorities.DESTINATION_CHAIN_AUTHORITY_APPROVAL
  );
}

export function isFinalLifecycleAuthorityStep(step: ApprovalStep): boolean {
  return (
    getApprovalAuthorityForStep(step) ===
    ApprovalAuthorities.FINAL_LIFECYCLE_AUTHORITY
  );
}

export function assertValidApprovalAuthorityMapping(): void {
  const approvalSteps = Object.values(ApprovalStep);
  const mappedSteps = Object.keys(APPROVAL_AUTHORITY_BY_STEP) as ApprovalStep[];
  const knownAuthorities = new Set<ApprovalAuthority>(APPROVAL_AUTHORITIES);

  for (const step of approvalSteps) {
    if (!mappedSteps.includes(step)) {
      throw new Error(`Missing approval authority mapping for ${step}`);
    }
  }

  for (const step of mappedSteps) {
    if (!approvalSteps.includes(step)) {
      throw new Error(`Unknown approval step mapping for ${step}`);
    }

    const authority = getApprovalAuthorityForStep(step);
    if (!knownAuthorities.has(authority)) {
      throw new Error(`Unknown approval authority ${authority} for ${step}`);
    }
  }
}
