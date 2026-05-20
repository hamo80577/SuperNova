import assert from "node:assert/strict";

import {
  AccountStatus,
  ApprovalStatus,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  RequestStatus,
  UserRole
} from "@prisma/client";

import { UsersService } from "../src/users/users.service";

const now = new Date("2026-01-01T10:00:00.000Z");

function areaManager(overrides: Record<string, unknown> = {}) {
  return {
    id: "area-manager-1",
    ibsId: null,
    shopperId: null,
    role: UserRole.AREA_MANAGER,
    nameEn: "Area Manager",
    nameAr: null,
    phoneNumber: "01012345678",
    nationalId: "12345678901234",
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    uiTheme: "ORANGE",
    joiningDate: now,
    employmentStatus: EmploymentStatus.ACTIVE,
    resignationDate: null,
    accountStatus: AccountStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    passwordHash: "hashed",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as any;
}

function chain(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    chainName: `Chain ${id}`,
    chainCode: id.toUpperCase(),
    status: ChainStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as any;
}

function serviceHarness(options: {
  openRequestCount?: number;
  existingAssignments?: any[];
  targetUser?: any;
} = {}) {
  const createdAssignments: any[] = [];
  const closedAssignments: any[] = [];
  const auditRows: any[] = [];
  const targetUser = options.targetUser ?? areaManager();
  const chains = [chain("chain-1"), chain("chain-2")];
  const existingAssignments = options.existingAssignments ?? [];
  const assignment = {
    id: "assignment-1",
    areaManagerId: targetUser.id,
    chainId: "chain-1",
    status: AssignmentStatus.ACTIVE,
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    areaManager: targetUser,
    chain: chains[0]
  };

  const prisma = {
    user: {
      findUnique: async () => targetUser
    },
    chain: {
      findMany: async (args: any) =>
        chains.filter((item) => args.where.id.in.includes(item.id))
    },
    chainAreaManagerAssignment: {
      findMany: async (args: any) => {
        if (args.where?.chainId?.in) {
          return existingAssignments;
        }

        return [assignment, ...createdAssignments].filter(
          (item) =>
            item.areaManagerId === args.where.areaManagerId &&
            item.status === args.where.status
        );
      },
      findUnique: async () => assignment
    },
    request: {
      count: async () => options.openRequestCount ?? 0
    },
    $transaction: async (callback: any) =>
      callback({
        chainAreaManagerAssignment: {
          create: async (args: any) => {
            const created = {
              id: `created-${createdAssignments.length + 1}`,
              status: AssignmentStatus.ACTIVE,
              startDate: now,
              endDate: null,
              createdAt: now,
              updatedAt: now,
              ...args.data,
              chain: chains.find((item) => item.id === args.data.chainId)
            };
            createdAssignments.push(created);
            return created;
          },
          update: async (args: any) => {
            const closed = {
              ...assignment,
              ...args.data
            };
            closedAssignments.push(closed);
            return closed;
          }
        },
        auditLog: {
          createMany: async (args: any) => {
            auditRows.push(...args.data);
            return { count: args.data.length };
          },
          create: async (args: any) => {
            auditRows.push(args.data);
            return args.data;
          }
        }
      })
  };

  return {
    auditRows,
    closedAssignments,
    createdAssignments,
    service: new UsersService(
      { log: async () => undefined } as any,
      prisma as any,
      {} as any
    )
  };
}

async function run() {
  {
    const harness = serviceHarness();
    const result = await harness.service.addAreaManagerChainAssignments(
      "area-manager-1",
      { chainIds: ["chain-1", "chain-2"] },
      { id: "admin-1", role: UserRole.ADMIN } as any,
      { ipAddress: "127.0.0.1", userAgent: "test" }
    );

    assert.equal(harness.createdAssignments.length, 2);
    assert.equal(result.assignments.length >= 1, true);
    assert.equal(
      harness.auditRows.some(
        (row) => row.action === "AREA_MANAGER_CHAIN_ASSIGNMENT_CREATED"
      ),
      true
    );
  }

  await assert.rejects(
    () =>
      serviceHarness({ targetUser: areaManager({ role: UserRole.CHAMP }) })
        .service.addAreaManagerChainAssignments(
          "champ-1",
          { chainIds: ["chain-1"] },
          { id: "admin-1", role: UserRole.ADMIN } as any,
          {}
        ),
    /Target user must be an Area Manager/
  );

  await assert.rejects(
    () =>
      serviceHarness({ openRequestCount: 1 }).service.removeAreaManagerChainAssignment(
        "area-manager-1",
        "assignment-1",
        { id: "admin-1", role: UserRole.ADMIN } as any,
        {}
      ),
    /Cannot remove this Chain from the Area Manager while open requests require action on this Chain./
  );

  {
    const harness = serviceHarness({ openRequestCount: 0 });
    await harness.service.removeAreaManagerChainAssignment(
      "area-manager-1",
      "assignment-1",
      { id: "admin-1", role: UserRole.SUPER_ADMIN } as any,
      {}
    );

    assert.equal(harness.closedAssignments[0].status, AssignmentStatus.CLOSED);
    assert.equal(
      harness.auditRows.some(
        (row) => row.action === "AREA_MANAGER_CHAIN_ASSIGNMENT_CLOSED"
      ),
      true
    );
  }

  assert.deepEqual(
    [
      RequestStatus.DRAFT,
      RequestStatus.PENDING_AREA_MANAGER,
      RequestStatus.PENDING_DESTINATION_AREA_MANAGER,
      RequestStatus.PENDING_ADMIN
    ].length,
    4
  );
  assert.equal(ApprovalStatus.PENDING, "PENDING");
}

void run();
