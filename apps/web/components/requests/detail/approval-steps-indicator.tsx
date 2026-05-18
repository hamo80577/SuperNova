import { Check, Clock3, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type ApprovalStep,
  type RequestApprovalSummary,
  type RequestSummary
} from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import {
  formatEnum,
  parseNewHirePayload,
  parseOffboardingPayload,
  parseTransferPayload
} from "../shared/request-utils";

type ProgressState =
  | "cancelled"
  | "completed"
  | "current"
  | "pending"
  | "rejected"
  | "skipped";

type ProgressStepKind = "approval" | "completed" | "submitted";

interface ProgressStepDefinition {
  approvalStep?: ApprovalStep;
  fallbackActorLabel?: string;
  id: string;
  kind: ProgressStepKind;
  title: string;
}

interface ProgressStep extends ProgressStepDefinition {
  actorLabel?: string;
  state: ProgressState;
  statusLabel: string;
}

const completedRequestStatuses = new Set(["APPROVED", "COMPLETED"]);

export function ApprovalStepsIndicator({ request }: { request: RequestSummary }) {
  const steps = buildProgressSteps(request);

  return (
    <section
      aria-label="Request workflow progress"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Workflow progress
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Current approval position for this request.
          </p>
        </div>
        <Badge className="border-slate-200 bg-slate-50 text-slate-700" variant="outline">
          {formatEnum(request.status)}
        </Badge>
      </div>

      <ol className="grid gap-0 md:hidden">
        {steps.map((step, index) => (
          <MobileProgressStep
            index={index}
            isLast={index === steps.length - 1}
            key={step.id}
            nextStep={steps[index + 1]}
            step={step}
          />
        ))}
      </ol>

      <ol
        className="hidden md:grid"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => (
          <DesktopProgressStep
            index={index}
            isLast={index === steps.length - 1}
            key={step.id}
            nextStep={steps[index + 1]}
            step={step}
          />
        ))}
      </ol>
    </section>
  );
}

export function ApprovalProgressDots({
  className,
  request
}: {
  className?: string;
  request: RequestSummary;
}) {
  const steps = buildProgressSteps(request);

  return (
    <div
      aria-label={`Workflow progress: ${steps
        .map((step) => `${step.title} ${step.statusLabel}`)
        .join(", ")}`}
      className={cn(
        "flex items-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-2",
        className
      )}
      role="img"
    >
      {steps.map((step, index) => (
        <div
          className={cn("flex items-center", index === steps.length - 1 ? "" : "flex-1")}
          key={step.id}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white",
              getMiniDotClass(step.state)
            )}
          />
          {index < steps.length - 1 ? (
            <span
              className={cn(
                "mx-1 h-0.5 min-w-3 flex-1 rounded-full",
                getMiniConnectorClass(step, steps[index + 1])
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MobileProgressStep({
  index,
  isLast,
  nextStep,
  step
}: {
  index: number;
  isLast: boolean;
  nextStep?: ProgressStep;
  step: ProgressStep;
}) {
  return (
    <li
      aria-current={step.state === "current" ? "step" : undefined}
      className="relative flex min-w-0 gap-3 pb-4 last:pb-0"
    >
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            "absolute left-5 top-10 h-[calc(100%-2.5rem)] border-l-2",
            getConnectorClass(step, nextStep)
          )}
        />
      ) : null}
      <StepCircle index={index} step={step} />
      <StepContent step={step} />
    </li>
  );
}

function DesktopProgressStep({
  index,
  isLast,
  nextStep,
  step
}: {
  index: number;
  isLast: boolean;
  nextStep?: ProgressStep;
  step: ProgressStep;
}) {
  return (
    <li
      aria-current={step.state === "current" ? "step" : undefined}
      className="relative min-w-0 px-2"
    >
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            "absolute left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] top-5 border-t-2",
            getConnectorClass(step, nextStep)
          )}
        />
      ) : null}
      <div className="relative z-10 flex min-w-0 flex-col items-center text-center">
        <StepCircle index={index} step={step} />
        <StepContent centered step={step} />
      </div>
    </li>
  );
}

function StepCircle({ index, step }: { index: number; step: ProgressStep }) {
  const Icon =
    step.state === "completed"
      ? Check
      : step.state === "rejected" || step.state === "cancelled"
        ? X
        : step.state === "skipped"
          ? Minus
          : step.state === "current"
            ? Clock3
            : null;

  return (
    <span
      className={cn(
        "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-semibold",
        getCircleClass(step.state)
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : index + 1}
    </span>
  );
}

function StepContent({
  centered = false,
  step
}: {
  centered?: boolean;
  step: ProgressStep;
}) {
  return (
    <div className={cn("min-w-0 pt-0.5", centered ? "mt-3 max-w-36" : "flex-1")}>
      <p className="text-sm font-semibold leading-5 text-slate-950">
        {step.title}
      </p>
      <div className={cn("mt-2 flex flex-wrap gap-1.5", centered && "justify-center")}>
        <Badge
          className={cn("border px-2 py-0.5 text-[11px]", getPillClass(step.state))}
          variant="outline"
        >
          {step.statusLabel}
        </Badge>
      </div>
      {step.actorLabel ? (
        <p className="mt-2 break-words text-xs leading-5 text-slate-500">
          {step.actorLabel}
        </p>
      ) : null}
    </div>
  );
}

function buildProgressSteps(request: RequestSummary): ProgressStep[] {
  const approvalsByStep = new Map<ApprovalStep, RequestApprovalSummary>();
  request.approvals.forEach((approval) => {
    approvalsByStep.set(approval.step, approval);
  });
  const definitions = buildStepDefinitions(request);
  const rejectedApprovalStepIndex = definitions.findIndex(
    (definition) =>
      definition.approvalStep &&
      approvalsByStep.get(definition.approvalStep)?.status === "REJECTED"
  );
  const rejectedStepIndex =
    rejectedApprovalStepIndex >= 0
      ? rejectedApprovalStepIndex
      : request.status === "REJECTED"
        ? definitions.findIndex(
            (definition) => definition.approvalStep === request.currentStep
          )
        : -1;

  return definitions.map((definition, index) => {
    const approval = definition.approvalStep
      ? approvalsByStep.get(definition.approvalStep)
      : undefined;
    const state = resolveStepState(
      request,
      definition,
      approval,
      index,
      rejectedStepIndex
    );

    return {
      ...definition,
      actorLabel: getActorLabel(request, definition, approval),
      state,
      title: getDisplayTitle(definition, state),
      statusLabel: getStatusLabel(definition, state)
    };
  });
}

function buildStepDefinitions(request: RequestSummary): ProgressStepDefinition[] {
  const requestType = request.type;

  if (requestType === "TRANSFER") {
    const isCrossChain = isCrossChainTransfer(request);

    return [
      {
        fallbackActorLabel: request.createdBy.nameEn,
        id: "submitted",
        kind: "submitted",
        title: "Request Submitted"
      },
      {
        approvalStep: "SOURCE_AREA_MANAGER_APPROVAL",
        fallbackActorLabel: "Source Area Manager",
        id: "source-area-manager-approval",
        kind: "approval",
        title: "Source Area Manager Approval"
      },
      ...(isCrossChain
        ? [
            {
              approvalStep: "DESTINATION_AREA_MANAGER_APPROVAL" as const,
              fallbackActorLabel: "Destination Area Manager",
              id: "destination-area-manager-approval",
              kind: "approval" as const,
              title: "Destination Area Manager Approval"
            }
          ]
        : []),
      {
        id: "transfer-applied",
        kind: "completed",
        title: "Transfer Applied"
      }
    ];
  }

  if (requestType === "NEW_HIRE" || requestType === "RESIGNATION") {
    const newHireContext =
      requestType === "NEW_HIRE" ? parseNewHirePayload(request.payload) : null;
    const resignationContext =
      requestType === "RESIGNATION"
        ? parseOffboardingPayload(request.payload)
        : null;
    const requiresAreaManagerApproval =
      newHireContext?.targetRole !== "AREA_MANAGER" &&
      resignationContext?.targetRole !== "AREA_MANAGER";

    return [
      {
        fallbackActorLabel: request.createdBy.nameEn,
        id: "submitted",
        kind: "submitted",
        title: "Request Submitted"
      },
      ...(requiresAreaManagerApproval
        ? [
            {
              approvalStep: "AREA_MANAGER_APPROVAL" as const,
              fallbackActorLabel: "Area Manager",
              id: "area-manager-approval",
              kind: "approval" as const,
              title: "Area Manager Approval"
            }
          ]
        : []),
      {
        approvalStep: "ADMIN_FINAL_APPROVAL",
        fallbackActorLabel: "Admin",
        id: "admin-final-action",
        kind: "approval",
        title: "Admin Final Action"
      },
      {
        id: "completed",
        kind: "completed",
        title: "Completed"
      }
    ];
  }

  return [
    {
      fallbackActorLabel: request.createdBy.nameEn,
      id: "submitted",
      kind: "submitted",
      title: "Request Submitted"
    },
    {
      id: "completed",
      kind: "completed",
      title: "Completed"
    }
  ];
}

function resolveStepState(
  request: RequestSummary,
  definition: ProgressStepDefinition,
  approval: RequestApprovalSummary | undefined,
  index: number,
  rejectedStepIndex: number
): ProgressState {
  const requestCompleted = completedRequestStatuses.has(request.status);
  const requestRejected = request.status === "REJECTED";
  const requestCancelled = request.status === "CANCELLED";

  if (definition.kind === "submitted") {
    if (requestCancelled && !request.currentStep) return "cancelled";
    if (request.status === "DRAFT") return "current";
    return "completed";
  }

  if (definition.kind === "completed") {
    if (requestRejected) return "rejected";
    if (requestCancelled) return "cancelled";
    return requestCompleted ? "completed" : "pending";
  }

  if (requestRejected && rejectedStepIndex >= 0 && index > rejectedStepIndex) {
    return "skipped";
  }
  if (approval?.status === "SKIPPED") return "skipped";
  if (approval?.status === "REJECTED") return "rejected";
  if (requestRejected && definition.approvalStep === request.currentStep) {
    return "rejected";
  }
  if (requestCancelled && definition.approvalStep === request.currentStep) {
    return "cancelled";
  }
  if (approval?.status === "APPROVED" || requestCompleted) return "completed";
  if (approval?.status === "PENDING" || definition.approvalStep === request.currentStep) {
    return "current";
  }

  return "pending";
}

function getActorLabel(
  request: RequestSummary,
  definition: ProgressStepDefinition,
  approval: RequestApprovalSummary | undefined
) {
  if (definition.kind === "submitted") {
    return definition.fallbackActorLabel ? `By ${definition.fallbackActorLabel}` : undefined;
  }

  if (definition.kind === "completed") {
    return request.completedAt
      ? new Date(request.completedAt).toLocaleDateString()
      : undefined;
  }

  if (approval?.approver?.nameEn) return approval.approver.nameEn;
  if (approval?.approverRole) return formatEnum(approval.approverRole);
  return definition.fallbackActorLabel;
}

function getDisplayTitle(definition: ProgressStepDefinition, state: ProgressState) {
  if (definition.kind === "completed" && state === "rejected") return "Rejected";
  if (definition.kind === "completed" && state === "cancelled") return "Cancelled";
  return definition.title;
}

function getStatusLabel(
  definition: ProgressStepDefinition,
  state: ProgressState
) {
  if (state === "cancelled") return "Cancelled";
  if (state === "current") return "Waiting for action";
  if (state === "pending") return "Pending";
  if (state === "rejected") return "Rejected";
  if (state === "skipped") return "Skipped";
  if (definition.kind === "submitted") return "Submitted";
  if (definition.kind === "completed") return "Completed";
  return "Approved";
}

function isCrossChainTransfer(request: RequestSummary) {
  const transferPayload =
    request.type === "TRANSFER" ? parseTransferPayload(request.payload) : null;
  const sourceChainId = request.sourceChain?.id ?? transferPayload?.sourceChainId;
  const destinationChainId =
    request.destinationChain?.id ?? transferPayload?.destinationChainId;
  const hasDestinationApproval = request.approvals.some(
    (approval) => approval.step === "DESTINATION_AREA_MANAGER_APPROVAL"
  );

  if (hasDestinationApproval) {
    return true;
  }

  return Boolean(
    sourceChainId && destinationChainId && sourceChainId !== destinationChainId
  );
}

function getCircleClass(state: ProgressState) {
  if (state === "completed") return "border-emerald-600 bg-emerald-600 text-white";
  if (state === "current") return "border-blue-600 bg-blue-600 text-white";
  if (state === "rejected") return "border-red-600 bg-red-600 text-white";
  if (state === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  if (state === "skipped") return "border-slate-300 bg-slate-100 text-slate-500";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function getPillClass(state: ProgressState) {
  if (state === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "current") return "border-blue-200 bg-blue-50 text-blue-700";
  if (state === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (state === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  if (state === "skipped") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function getConnectorClass(step: ProgressStep, nextStep: ProgressStep | undefined) {
  if (step.state === "rejected") return "border-red-300";
  if (step.state === "cancelled") return "border-red-200";
  if (step.state === "skipped") return "border-dashed border-slate-300";
  if (step.state === "completed" && nextStep?.state === "completed") {
    return "border-emerald-300";
  }
  if (step.state === "completed" && nextStep?.state === "current") {
    return "border-blue-300";
  }
  if (step.state === "current") return "border-blue-300";
  return "border-slate-200";
}

function getMiniDotClass(state: ProgressState) {
  if (state === "completed") return "bg-emerald-500";
  if (state === "current") return "bg-blue-600";
  if (state === "rejected") return "bg-red-600";
  if (state === "cancelled") return "bg-red-300";
  if (state === "skipped") return "bg-slate-300";
  return "bg-slate-200";
}

function getMiniConnectorClass(
  step: ProgressStep,
  nextStep: ProgressStep | undefined
) {
  if (step.state === "rejected") return "bg-red-200";
  if (step.state === "cancelled") return "bg-red-100";
  if (step.state === "skipped") return "bg-slate-200";
  if (step.state === "completed" && nextStep?.state === "completed") {
    return "bg-emerald-300";
  }
  if (step.state === "completed" && nextStep?.state === "current") {
    return "bg-blue-300";
  }
  if (step.state === "current") return "bg-blue-200";
  return "bg-slate-200";
}
