import { Prisma } from "@prisma/client";

export const requestInclude = {
  createdBy: true,
  targetUser: true,
  sourceChain: true,
  sourceVendor: { include: { chain: true } },
  destinationChain: true,
  destinationVendor: { include: { chain: true } },
  approvals: {
    include: { approver: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.RequestInclude;

export type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

export const requestDetailInclude = {
  ...requestInclude,
  hrSyncLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 1
  }
} satisfies Prisma.RequestInclude;

export type RequestDetailWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestDetailInclude;
}>;

export const requestApprovalWithRequestInclude = {
  request: {
    include: requestInclude
  }
} satisfies Prisma.RequestApprovalInclude;

export type RequestApprovalWithRequest = Prisma.RequestApprovalGetPayload<{
  include: typeof requestApprovalWithRequestInclude;
}>;
