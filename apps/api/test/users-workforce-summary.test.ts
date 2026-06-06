import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  EmploymentStatus,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { WorkforceSummaryQueryDto } from "../src/users/dto/workforce-summary-query.dto";
import { UsersService } from "../src/users/users.service";

type CountCall = {
  model: "request" | "user";
  args: { where: unknown };
};

type AssignmentFindCall = {
  model:
    | "pickerBranchAssignment"
    | "vendorChampAssignment"
    | "chainAreaManagerAssignment";
  args: { where: unknown };
};

function assignmentRows(ids: string[], key: string) {
  return ids.map((id) => ({ [key]: id }));
}

function serviceHarness(options: {
  pickerSnapshots?: string[][];
  champSnapshots?: string[][];
  areaManagerSnapshots?: string[][];
  requestCounts?: number[];
  userCounts?: number[];
}) {
  const assignmentFindCalls: AssignmentFindCall[] = [];
  const countCalls: CountCall[] = [];
  const pickerSnapshots = [...(options.pickerSnapshots ?? [])];
  const champSnapshots = [...(options.champSnapshots ?? [])];
  const areaManagerSnapshots = [...(options.areaManagerSnapshots ?? [])];
  const requestCounts = [...(options.requestCounts ?? [])];
  const userCounts = [...(options.userCounts ?? [])];

  const prisma = {
    pickerBranchAssignment: {
      findMany: async (args: { where: unknown }) => {
        assignmentFindCalls.push({ model: "pickerBranchAssignment", args });
        return assignmentRows(pickerSnapshots.shift() ?? [], "pickerId");
      }
    },
    vendorChampAssignment: {
      findMany: async (args: { where: unknown }) => {
        assignmentFindCalls.push({ model: "vendorChampAssignment", args });
        return assignmentRows(champSnapshots.shift() ?? [], "champId");
      }
    },
    chainAreaManagerAssignment: {
      findMany: async (args: { where: unknown }) => {
        assignmentFindCalls.push({ model: "chainAreaManagerAssignment", args });
        return assignmentRows(areaManagerSnapshots.shift() ?? [], "areaManagerId");
      }
    },
    request: {
      count: async (args: { where: unknown }) => {
        countCalls.push({ model: "request", args });
        return requestCounts.shift() ?? 0;
      }
    },
    user: {
      count: async (args: { where: unknown }) => {
        countCalls.push({ model: "user", args });
        return userCounts.shift() ?? 0;
      }
    }
  };

  return {
    assignmentFindCalls,
    countCalls,
    service: new UsersService({} as never, prisma as never, {} as never)
  };
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

async function run() {
  {
    const dto = plainToInstance(WorkforceSummaryQueryDto, {});
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true
    });

    assert.equal(errors.length, 0);
    assert.equal(dto.period, "this-month");
    assert.equal(dto.role, "PICKER");
  }

  {
    const harness = serviceHarness({
      pickerSnapshots: [
        ["picker-1", "picker-2", "picker-2"],
        ["picker-1", "picker-2", "picker-3", "picker-4"]
      ],
      requestCounts: [3, 1]
    });

    const summary = await harness.service.getWorkforceSummary({
      role: "PICKER",
      chainId: "chain-1",
      vendorId: "vendor-1",
      areaManagerId: "area-manager-1",
      champId: "champ-1"
    });

    assert.equal(summary.role, "PICKER");
    assert.equal(summary.startingHeadcount, 2);
    assert.equal(summary.newHires, 3);
    assert.equal(summary.exited, 1);
    assert.equal(summary.endingHeadcount, 4);
    assert.equal(summary.averageHeadcount, 3);
    assert.equal(summary.attritionRate, 33.33);
    assert.equal(summary.netMovement, 2);
    assert.equal(summary.period.label, "This month");

    assert.equal(harness.assignmentFindCalls.length, 2);
    assert.equal(harness.countCalls.length, 2);

    const assignmentWhere = serialized(harness.assignmentFindCalls[0].args.where);
    assert.match(assignmentWhere, /chain-1/);
    assert.match(assignmentWhere, /vendor-1/);
    assert.match(assignmentWhere, /area-manager-1/);
    assert.match(assignmentWhere, /champ-1/);
    assert.match(assignmentWhere, /startDate/);
    assert.match(assignmentWhere, /endDate/);

    const requestWhere = serialized(harness.countCalls[0].args.where);
    assert.match(requestWhere, new RegExp(RequestType.NEW_HIRE));
    assert.match(requestWhere, new RegExp(RequestStatus.COMPLETED));
    assert.match(requestWhere, new RegExp(UserRole.PICKER));
    assert.match(requestWhere, /completedAt/);
    assert.match(requestWhere, /sourceChainId/);
    assert.match(requestWhere, /sourceVendorId/);
    assert.match(requestWhere, /chain-1/);
    assert.match(requestWhere, /vendor-1/);
  }

  {
    const harness = serviceHarness({
      areaManagerSnapshots: [
        ["area-manager-1", "area-manager-1", "area-manager-2"],
        ["area-manager-1"]
      ],
      requestCounts: [1, 2]
    });

    const summary = await harness.service.getWorkforceSummary({
      role: "MANAGEMENT",
      chainId: "chain-1"
    });

    assert.equal(summary.role, "MANAGEMENT");
    assert.equal(summary.startingHeadcount, 2);
    assert.equal(summary.newHires, 1);
    assert.equal(summary.exited, 2);
    assert.equal(summary.endingHeadcount, 1);
    assert.equal(summary.averageHeadcount, 1.5);
    assert.equal(summary.attritionRate, 133.33);
    assert.equal(summary.netMovement, -1);
    assert.equal(
      harness.countCalls.some((call) => call.model === "user"),
      false
    );

    const areaManagerWhere = serialized(
      harness.assignmentFindCalls[0].args.where
    );
    assert.match(areaManagerWhere, /chain-1/);
    assert.match(areaManagerWhere, /startDate/);
    assert.match(areaManagerWhere, /endDate/);
  }

  {
    const harness = serviceHarness({
      areaManagerSnapshots: [["area-manager-1"], ["area-manager-1"]],
      requestCounts: [1, 0],
      userCounts: [2, 3, 1, 1]
    });

    const summary = await harness.service.getWorkforceSummary({
      role: "MANAGEMENT"
    });

    assert.equal(summary.role, "MANAGEMENT");
    assert.equal(summary.startingHeadcount, 3);
    assert.equal(summary.newHires, 2);
    assert.equal(summary.exited, 1);
    assert.equal(summary.endingHeadcount, 4);
    assert.equal(summary.averageHeadcount, 3.5);
    assert.equal(summary.attritionRate, 28.57);
    assert.equal(summary.netMovement, 1);

    const userCountCalls = harness.countCalls.filter(
      (call) => call.model === "user"
    );
    assert.equal(userCountCalls.length, 4);
    const userWhere = serialized(userCountCalls[0].args.where);
    assert.match(userWhere, new RegExp(UserRole.ADMIN));
    assert.match(userWhere, new RegExp(UserRole.SUPER_ADMIN));
    assert.match(userWhere, new RegExp(AccountStatus.ACTIVE));
    assert.match(userWhere, new RegExp(EmploymentStatus.ACTIVE));
  }
}

void run();
