import { BadRequestException } from "@nestjs/common";
import { RequestStatus } from "@prisma/client";

export const pendingRequestStatuses = [
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN
] as const;

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.DRAFT]: [
    RequestStatus.PENDING_AREA_MANAGER,
    RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
    RequestStatus.PENDING_ADMIN,
    RequestStatus.CANCELLED
  ],
  [RequestStatus.PENDING_AREA_MANAGER]: [
    RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
    RequestStatus.PENDING_ADMIN,
    RequestStatus.APPROVED,
    RequestStatus.COMPLETED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED
  ],
  [RequestStatus.PENDING_DESTINATION_AREA_MANAGER]: [
    RequestStatus.PENDING_ADMIN,
    RequestStatus.APPROVED,
    RequestStatus.COMPLETED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED
  ],
  [RequestStatus.PENDING_ADMIN]: [
    RequestStatus.APPROVED,
    RequestStatus.COMPLETED,
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED
  ],
  [RequestStatus.APPROVED]: [],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.COMPLETED]: []
};

export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus
) {
  if (!allowedTransitions[from].includes(to)) {
    throw new BadRequestException(
      `Request status cannot transition from ${from} to ${to}.`
    );
  }
}

export function isPendingRequestStatus(status: RequestStatus) {
  return pendingRequestStatuses.includes(
    status as (typeof pendingRequestStatuses)[number]
  );
}
