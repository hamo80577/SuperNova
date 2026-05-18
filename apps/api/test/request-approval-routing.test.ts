import assert from "node:assert/strict";

import { BadRequestException } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStep,
  AssignmentStatus,
  BlockStatus,
  EmploymentStatus,
  UserRole
} from "@prisma/client";

import { RequestApprovalRoutingService } from "../src/requests/request-approval-routing.service";

function areaManagerAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    chainId: "chain-1",
    areaManagerId: "area-manager-1",
    status: AssignmentStatus.ACTIVE,
    areaManager: {
      id: "area-manager-1",
      role: UserRole.AREA_MANAGER,
      accountStatus: AccountStatus.ACTIVE,
      employmentStatus: EmploymentStatus.ACTIVE,
      blockStatus: BlockStatus.NO_BLOCK,
      blockedUntil: null,
      ...overrides
    }
  };
}

function serviceWithAssignment(assignment: unknown) {
  return new RequestApprovalRoutingService({
    chainAreaManagerAssignment: {
      findFirst: async () => assignment
    }
  } as any);
}

async function expectIneligibleAssignmentRejected(assignment: unknown) {
  await assert.rejects(
    () =>
      serviceWithAssignment(assignment).resolveAreaManagerStep(
        ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
        "chain-1"
      ),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.match(
        error.message,
        /No eligible active Area Manager assignment exists/
      );
      return true;
    }
  );
}

async function run() {
  const service = serviceWithAssignment(areaManagerAssignment());
  const step = await service.resolveAreaManagerStep(
    ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
    "chain-1"
  );
  assert.equal(step.step, ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL);
  assert.equal(step.approverRole, UserRole.AREA_MANAGER);
  assert.equal(step.approverId, "area-manager-1");
  assert.equal(step.chainId, "chain-1");

  await expectIneligibleAssignmentRejected(
    areaManagerAssignment({ role: UserRole.CHAMP })
  );
  await expectIneligibleAssignmentRejected(
    areaManagerAssignment({ accountStatus: AccountStatus.SUSPENDED })
  );
  await expectIneligibleAssignmentRejected(
    areaManagerAssignment({ employmentStatus: EmploymentStatus.RESIGNED })
  );
  await expectIneligibleAssignmentRejected(
    areaManagerAssignment({ blockStatus: BlockStatus.PERMANENT_BLOCK })
  );
  await expectIneligibleAssignmentRejected(
    areaManagerAssignment({
      blockStatus: BlockStatus.TEMPORARY_BLOCK,
      blockedUntil: new Date(Date.now() + 60_000)
    })
  );

  const expiredTemporaryBlockStep = await serviceWithAssignment(
    areaManagerAssignment({
      blockStatus: BlockStatus.TEMPORARY_BLOCK,
      blockedUntil: new Date(Date.now() - 60_000)
    })
  ).resolveAreaManagerStep(
    ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
    "chain-1"
  );
  assert.equal(
    expiredTemporaryBlockStep.step,
    ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
  );
}

void run();
