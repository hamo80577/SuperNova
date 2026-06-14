import type { ApprovalStep } from "@/lib/api/requests";

export type ProgressState =
  | "cancelled"
  | "completed"
  | "current"
  | "pending"
  | "rejected"
  | "skipped";

export type ProgressStepKind = "approval" | "completed" | "submitted";

export interface ProgressStepDefinition {
  approvalStep?: ApprovalStep;
  fallbackActorLabel?: string;
  id: string;
  kind: ProgressStepKind;
  title: string;
}

type AnnualLeaveProgressInput = {
  approvals: Array<{ step: ApprovalStep }>;
  createdBy: { nameEn: string };
};

type AnnualLeaveApprovalStep = Extract<
  ApprovalStep,
  "CHAMP_APPROVAL" | "AREA_MANAGER_APPROVAL" | "ADMIN_FINAL_APPROVAL"
>;

const annualLeaveApprovalOrder: AnnualLeaveApprovalStep[] = [
  "CHAMP_APPROVAL",
  "AREA_MANAGER_APPROVAL",
  "ADMIN_FINAL_APPROVAL"
];

const annualLeaveApprovalDefinitions: Record<
  AnnualLeaveApprovalStep,
  ProgressStepDefinition
> = {
  CHAMP_APPROVAL: {
    approvalStep: "CHAMP_APPROVAL",
    fallbackActorLabel: "Champ",
    id: "annual-champ-approval",
    kind: "approval",
    title: "Champ Approval"
  },
  AREA_MANAGER_APPROVAL: {
    approvalStep: "AREA_MANAGER_APPROVAL",
    fallbackActorLabel: "Area Manager",
    id: "annual-area-manager-approval",
    kind: "approval",
    title: "Area Manager Approval"
  },
  ADMIN_FINAL_APPROVAL: {
    approvalStep: "ADMIN_FINAL_APPROVAL",
    fallbackActorLabel: "Admin",
    id: "annual-admin-final-approval",
    kind: "approval",
    title: "Admin Final Approval"
  }
};

export function buildAnnualLeaveStepDefinitions(
  request: AnnualLeaveProgressInput
): ProgressStepDefinition[] {
  const approvalSteps = new Set(
    request.approvals.map((approval) => approval.step)
  );

  return [
    {
      fallbackActorLabel: request.createdBy.nameEn,
      id: "submitted",
      kind: "submitted",
      title: "Request Submitted"
    },
    ...annualLeaveApprovalOrder
      .filter((step) => approvalSteps.has(step))
      .map((step) => annualLeaveApprovalDefinitions[step]),
    {
      id: "annual-leave-approved",
      kind: "completed",
      title: "Annual Leave Approved"
    }
  ];
}
