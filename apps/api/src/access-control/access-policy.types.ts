import type { UserRole } from "@prisma/client";

export type AccessPolicyActor = Readonly<{
  id: string;
  role: UserRole;
}>;

export type AccessPolicyContext = Readonly<{
  chainId?: string;
  vendorId?: string;
  requestId?: string;
  approvalId?: string;
  targetUserId?: string;
  sourceChainId?: string;
  destinationChainId?: string;
}>;
