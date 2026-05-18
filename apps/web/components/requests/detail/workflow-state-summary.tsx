import { type RequestDetail } from "@/lib/api/requests";
import { Definition } from "../shared/request-field";
import { formatEnum, parseNewHirePayload, parseOffboardingPayload, parseTransferPayload } from "../shared/request-utils";

export function WorkflowStateSummary({ request }: { request: RequestDetail }) {
  const newHireContext =
    request.type === "NEW_HIRE" ? parseNewHirePayload(request.payload) : null;
  const finalAction =
    request.status === "PENDING_ADMIN" &&
    request.currentStep === "ADMIN_FINAL_APPROVAL"
      ? request.type === "NEW_HIRE"
        ? newHireContext?.targetRole === "PICKER"
          ? "Admin must enter Shopper ID and finalize Picker New Hire."
          : newHireContext?.targetRole === "CHAMP"
            ? "Admin can finalize Champ New Hire without Shopper ID."
            : "Admin can finalize Area Manager New Hire without Shopper ID."
        : request.type === "RESIGNATION"
          ? "Admin must confirm Resignation and block decision."
          : "Admin review is pending."
      : request.status === "COMPLETED"
        ? "Workflow has been completed by the backend."
        : request.currentStep
          ? `${formatEnum(request.currentStep)} is the current actionable step.`
          : "No final action is currently required.";

  return (
    <>
      <Definition label="Workflow type" value={formatEnum(request.type)} />
      <Definition label="Current state" value={formatEnum(request.status)} />
      <Definition
        label="Current step"
        value={request.currentStep ? formatEnum(request.currentStep) : "None"}
      />
      <Definition label="Final action needed" value={finalAction} />
      {request.status === "COMPLETED" ? (
        <WorkflowResultSummary request={request} />
      ) : null}
    </>
  );
}

export function WorkflowResultSummary({ request }: { request: RequestDetail }) {
  if (request.type === "NEW_HIRE") {
    const context = parseNewHirePayload(request.payload);
    return (
      <>
        <Definition
          label="New Hire result"
          value={
            context?.finalization
              ? `${formatEnum(context.targetRole)} ${context.finalization.userId} completed.`
              : "Completed result is not available in payload."
          }
        />
        <Definition
          label="Assignment type"
          value={context?.finalization?.assignmentType ?? "Not available"}
        />
        <Definition
          label="Shopper ID"
          value={
            context?.targetRole === "PICKER"
              ? context?.finalization?.shopperId ?? "Not available"
              : "Not required"
          }
        />
      </>
    );
  }

  if (request.type === "RESIGNATION") {
    const context = parseOffboardingPayload(request.payload);
    return (
      <Definition
        label="Resignation result"
        value={
          context?.finalizedAt
            ? `${formatEnum(context.targetRole)} archived; assignment ${context.assignmentId} closed with ${formatEnum(
                context.blockStatus ?? "NO_BLOCK"
              )}.`
            : "Completed result is not available in payload."
        }
      />
    );
  }

  if (request.type === "TRANSFER") {
    const context = parseTransferPayload(request.payload);
    return (
      <Definition
        label="Transfer result"
        value={
          context?.completedAt
            ? `Old assignment ${context.oldAssignmentId} closed; new assignment ${context.newAssignmentId} opened.`
            : "Completed result is not available in payload."
        }
      />
    );
  }

  return null;
}
