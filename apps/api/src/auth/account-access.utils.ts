import { AccountStatus, BlockStatus, type User } from "@prisma/client";

type AccountAccessUser = Pick<
  User,
  "accountStatus" | "blockStatus" | "blockedUntil"
>;

export function getAccountAccessFailure(user: AccountAccessUser | null) {
  if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
    return "User account is not active.";
  }

  if (user.blockStatus === BlockStatus.PERMANENT_BLOCK) {
    return "User account is permanently blocked.";
  }

  if (
    user.blockStatus === BlockStatus.TEMPORARY_BLOCK &&
    (!user.blockedUntil || user.blockedUntil.getTime() > Date.now())
  ) {
    return "User account is temporarily blocked.";
  }

  return null;
}
