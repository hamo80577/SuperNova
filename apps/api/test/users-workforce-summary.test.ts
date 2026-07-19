import assert from "node:assert/strict";

import { ForbiddenException } from "@nestjs/common";
import {
  AccountStatus,
  AssignmentStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
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

function actor(role: UserRole, id = `actor-${role.toLowerCase()}`): AuthenticatedUser {
  return {
    id,
    role,
    nameEn: role,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function serviceHarness(options: {
  pickerSnapshots?: string[][];
  champSnapshots?: string[][];
  areaManagerSnapshots?: string[][];
  areaManagerScopeChainIds?: string[];
  areaManagerScopedChampIds?: string[];
  champScopeBranches?: Array<{ vendorId: string; chainId: string }>;
  vendors?: Array<{ id: string; chainId: string }>;
  userCounts?: number[];
}) {
  const assignmentFindCalls: AssignmentFindCall[] = [];
  const countCalls: CountCall[] = [];
  const pickerSnapshots = [...(options.pickerSnapshots ?? [])];
  const champSnapshots = [...(options.champSnapshots ?? [])];
  const areaManagerSnapshots = [...(options.areaManagerSnapshots ?? [])];
  const areaManagerScopeChainIds = [...(options.areaManagerScopeChainIds ?? [])];
  const areaManagerScopedChampIds = [
    ...(options.areaManagerScopedChampIds ?? [])
  ];
  const champScopeBranches = [...(options.champScopeBranches ?? [])];
  const vendors = [...(options.vendors ?? [])];
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
        if (
          "select" in args &&
          (args as { select?: { vendorId?: boolean } }).select?.vendorId
        ) {
          return champScopeBranches.map((branch) => ({
            vendorId: branch.vendorId,
            vendor: { chainId: branch.chainId }
          }));
        }
        return assignmentRows(champSnapshots.shift() ?? [], "champId");
      },
      findFirst: async (args: { where: { champId?: string } }) => {
        assignmentFindCalls.push({
          model: "vendorChampAssignment",
          args: args as { where: unknown }
        });
        return args.where.champId &&
          areaManagerScopedChampIds.includes(args.where.champId)
          ? { id: `assignment-${args.where.champId}` }
          : null;
      }
    },
    chainAreaManagerAssignment: {
      findMany: async (args: { where: unknown }) => {
        assignmentFindCalls.push({ model: "chainAreaManagerAssignment", args });
        if (
          "select" in args &&
          (args as { select?: { chainId?: boolean } }).select?.chainId
        ) {
          return assignmentRows(areaManagerScopeChainIds, "chainId");
        }
        return assignmentRows(areaManagerSnapshots.shift() ?? [], "areaManagerId");
      }
    },
    vendor: {
      findFirst: async (args: {
        where: { id?: string; chainId?: { in?: string[] } };
      }) => {
        const match = vendors.find(
          (vendor) =>
            vendor.id === args.where.id &&
            (!args.where.chainId?.in ||
              args.where.chainId.in.includes(vendor.chainId))
        );
        return match ? { id: match.id } : null;
      }
    },
    request: {},
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
    service: new UsersService({} as never, prisma as never, {} as never, {} as never)
  };
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

async function run() {
  const admin = actor(UserRole.ADMIN, "admin-1");

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
        ["picker-1", "picker-2", "picker-3", "picker-4"],
        ["picker-2", "picker-3", "picker-4"],
        ["picker-1"]
      ]
    });

    const summary = await harness.service.getWorkforceSummary(
      {
        role: "PICKER",
        chainId: "chain-1",
        vendorId: "vendor-1",
        areaManagerId: "area-manager-1",
        champId: "champ-1"
      },
      admin
    );

    assert.equal(summary.role, "PICKER");
    assert.equal(summary.startingHeadcount, 2);
    assert.equal(summary.newHires, 3);
    assert.equal(summary.exited, 1);
    assert.equal(summary.endingHeadcount, 4);
    assert.equal(summary.averageHeadcount, 3);
    assert.equal(summary.attritionRate, 33.33);
    assert.equal(summary.netMovement, 2);
    assert.equal(summary.period.label, "This month");

    assert.equal(harness.assignmentFindCalls.length, 4);
    assert.equal(harness.countCalls.length, 0);

    const assignmentWhere = serialized(harness.assignmentFindCalls[0].args.where);
    assert.match(assignmentWhere, /chain-1/);
    assert.match(assignmentWhere, /vendor-1/);
    assert.match(assignmentWhere, /area-manager-1/);
    assert.match(assignmentWhere, /champ-1/);
    assert.match(assignmentWhere, /startDate/);
    assert.match(assignmentWhere, /endDate/);

    const movementWhere = serialized(harness.assignmentFindCalls[2].args.where);
    assert.match(movementWhere, new RegExp(UserRole.PICKER));
    assert.match(movementWhere, /joiningDate/);
    assert.match(movementWhere, /chain-1/);
    assert.match(movementWhere, /vendor-1/);
  }

  {
    const harness = serviceHarness({
      areaManagerSnapshots: [
        ["area-manager-1", "area-manager-1", "area-manager-2"],
        ["area-manager-1"],
        ["area-manager-1"],
        ["area-manager-1", "area-manager-2"]
      ]
    });

    const summary = await harness.service.getWorkforceSummary(
      {
        role: "MANAGEMENT",
        chainId: "chain-1"
      },
      admin
    );

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
    const movementWhere = serialized(harness.assignmentFindCalls[2].args.where);
    assert.match(movementWhere, new RegExp(UserRole.AREA_MANAGER));
    assert.match(movementWhere, /joiningDate/);
  }

  {
    const harness = serviceHarness({
      areaManagerSnapshots: [
        ["area-manager-1"],
        ["area-manager-1"],
        [],
        []
      ],
      userCounts: [2, 3, 2, 1]
    });

    const summary = await harness.service.getWorkforceSummary(
      {
        role: "MANAGEMENT"
      },
      admin
    );

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

  {
    const areaManager = actor(UserRole.AREA_MANAGER, "area-manager-1");
    const harness = serviceHarness({
      areaManagerScopeChainIds: ["chain-1"],
      pickerSnapshots: [
        ["picker-1"],
        ["picker-1", "picker-2"],
        ["picker-1", "picker-2"],
        ["picker-1"]
      ]
    });

    const summary = await harness.service.getWorkforceSummary(
      { role: "PICKER" },
      areaManager
    );

    assert.equal(summary.role, "PICKER");
    assert.equal(summary.startingHeadcount, 1);
    assert.equal(summary.endingHeadcount, 2);
    assert.equal(summary.newHires, 2);
    assert.equal(summary.exited, 1);

    const pickerWhere = serialized(
      harness.assignmentFindCalls.find(
        (call) => call.model === "pickerBranchAssignment"
      )?.args.where
    );
    assert.match(pickerWhere, /chain-1/);

    const movementWhere = serialized(harness.assignmentFindCalls[4].args.where);
    assert.match(movementWhere, /resignationDate/);
    assert.match(movementWhere, /chain-1/);
  }

  {
    const areaManager = actor(UserRole.AREA_MANAGER, "area-manager-1");
    const harness = serviceHarness({
      areaManagerScopeChainIds: ["chain-1"],
      vendors: [{ id: "vendor-2", chainId: "chain-2" }]
    });

    await assert.rejects(
      () =>
        harness.service.getWorkforceSummary(
          { role: "PICKER", chainId: "chain-2" },
          areaManager
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        harness.service.getWorkforceSummary(
          { role: "PICKER", vendorId: "vendor-2" },
          areaManager
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        harness.service.getWorkforceSummary({ role: "ALL" }, areaManager),
      ForbiddenException
    );
  }

  {
    const areaManager = actor(UserRole.AREA_MANAGER, "area-manager-1");
    const harness = serviceHarness({
      areaManagerScopeChainIds: ["chain-1"],
      champSnapshots: [["champ-1"], ["champ-1", "champ-2"], ["champ-1"], []]
    });

    const summary = await harness.service.getWorkforceSummary(
      { role: "CHAMP" },
      areaManager
    );

    assert.equal(summary.role, "CHAMP");
    assert.equal(summary.startingHeadcount, 1);
    assert.equal(summary.endingHeadcount, 2);

    const champWhere = serialized(
      harness.assignmentFindCalls.find(
        (call) => call.model === "vendorChampAssignment"
      )?.args.where
    );
    assert.match(champWhere, /chain-1/);
  }

  {
    const champ = actor(UserRole.CHAMP, "champ-1");
    const harness = serviceHarness({
      champScopeBranches: [{ vendorId: "vendor-1", chainId: "chain-1" }],
      pickerSnapshots: [["picker-1"], ["picker-1", "picker-2"], ["picker-1"], []]
    });

    const summary = await harness.service.getWorkforceSummary(
      { role: "PICKER" },
      champ
    );

    assert.equal(summary.role, "PICKER");
    assert.equal(summary.startingHeadcount, 1);
    assert.equal(summary.endingHeadcount, 2);

    const pickerWhere = serialized(
      harness.assignmentFindCalls.find(
        (call) => call.model === "pickerBranchAssignment"
      )?.args.where
    );
    assert.match(pickerWhere, /vendor-1/);

    const movementWhere = serialized(harness.assignmentFindCalls[4].args.where);
    assert.match(movementWhere, /resignationDate/);
    assert.match(movementWhere, /vendor-1/);
  }

  {
    const champ = actor(UserRole.CHAMP, "champ-1");
    const harness = serviceHarness({
      champScopeBranches: [{ vendorId: "vendor-1", chainId: "chain-1" }]
    });

    await assert.rejects(
      () =>
        harness.service.getWorkforceSummary(
          { role: "PICKER", vendorId: "vendor-2" },
          champ
        ),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        harness.service.getWorkforceSummary({ role: "MANAGEMENT" }, champ),
      ForbiddenException
    );
    await assert.rejects(
      () => harness.service.getWorkforceSummary({ role: "ALL" }, champ),
      ForbiddenException
    );
  }
}

void run();
