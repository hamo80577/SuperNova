import type { RequestStatus, RequestType } from "@/lib/api/requests";
import type { UserRole } from "@/lib/auth/types";

export const requestTypeFilters: RequestType[] = [
  "NEW_HIRE",
  "RESIGNATION",
  "TRANSFER",
  "DEDUCTION",
  "ANNUAL_LEAVE"
];

export function canRenderNewRequestSheet({
  draftType,
  userRole
}: {
  draftType: RequestType;
  userRole?: UserRole;
}) {
  if (!userRole) {
    return false;
  }

  if (draftType === "ANNUAL_LEAVE") {
    return userRole === "PICKER" || userRole === "CHAMP";
  }

  return userRole !== "PICKER";
}

type RequestOperationsStatus = {
  status: RequestStatus;
  type: RequestType;
};

const closedStatuses: RequestStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];

export function isClosedRequestForOperations(request: RequestOperationsStatus) {
  return (
    closedStatuses.includes(request.status) || isApprovedAnnualLeave(request)
  );
}

export function isCompletedRequestForOperations(
  request: RequestOperationsStatus
) {
  return request.status === "COMPLETED" || isApprovedAnnualLeave(request);
}

function isApprovedAnnualLeave(request: RequestOperationsStatus) {
  return request.type === "ANNUAL_LEAVE" && request.status === "APPROVED";
}
