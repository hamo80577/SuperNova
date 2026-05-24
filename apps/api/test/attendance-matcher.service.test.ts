import assert from "node:assert/strict";

import { UserRole } from "@prisma/client";

import { AttendanceMatcherService } from "../src/attendance/attendance-matcher.service";

const users = [
  {
    id: "picker-1",
    role: UserRole.PICKER,
    shopperId: "SHOP-1",
    ibsId: null,
    joiningDate: null
  },
  {
    id: "champ-1",
    role: UserRole.CHAMP,
    shopperId: null,
    ibsId: "IBS-1",
    joiningDate: null
  },
  {
    id: "admin-with-identifier",
    role: UserRole.ADMIN,
    shopperId: "ADMIN-IDENTIFIER",
    ibsId: null,
    joiningDate: null
  },
  {
    id: "ambiguous-picker",
    role: UserRole.PICKER,
    shopperId: "CROSS-1",
    ibsId: null,
    joiningDate: null
  },
  {
    id: "ambiguous-champ",
    role: UserRole.CHAMP,
    shopperId: null,
    ibsId: "CROSS-1",
    joiningDate: null
  }
];

const prisma = {
  user: {
    findMany: async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
      const identifiers = new Set<string>();
      for (const clause of where.OR) {
        const shopper = clause.shopperId as { in?: string[] } | string | undefined;
        const ibs = clause.ibsId as { in?: string[] } | string | undefined;
        if (typeof shopper === "string") identifiers.add(shopper);
        if (typeof ibs === "string") identifiers.add(ibs);
        shopper?.in?.forEach((value) => identifiers.add(value));
        ibs?.in?.forEach((value) => identifiers.add(value));
      }

      return users.filter(
        (user) =>
          (user.shopperId && identifiers.has(user.shopperId)) ||
          (user.ibsId && identifiers.has(user.ibsId))
      );
    }
  }
};

async function main() {
  const service = new AttendanceMatcherService(prisma as never);

  const picker = await service.matchIdentifier("SHOP-1");
  assert.equal(picker.outcome, "MATCHED_PICKER");
  assert.equal(picker.user?.id, "picker-1");
  assert.equal(picker.matchKeyType, "SHOPPER_ID");

  const champ = await service.matchIdentifier("IBS-1");
  assert.equal(champ.outcome, "MATCHED_CHAMP");
  assert.equal(champ.user?.id, "champ-1");
  assert.equal(champ.matchKeyType, "IBS_ID");

  const roleFromSystem = await service.matchIdentifier("SHOP-1");
  assert.equal(roleFromSystem.user?.role, UserRole.PICKER);

  const unmatched = await service.matchIdentifier("NO-MATCH");
  assert.equal(unmatched.outcome, "UNMATCHED_IDENTIFIER");

  const ambiguous = await service.matchIdentifier("CROSS-1");
  assert.equal(ambiguous.outcome, "AMBIGUOUS_IDENTIFIER_MATCH");
  assert.equal(ambiguous.user, null);

  const unsupported = await service.matchIdentifier("ADMIN-IDENTIFIER");
  assert.equal(unsupported.outcome, "UNSUPPORTED_ROLE");
  assert.equal(unsupported.user?.role, UserRole.ADMIN);
}

void main();

