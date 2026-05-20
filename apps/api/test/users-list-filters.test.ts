import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  RequestStatus,
  RequestType,
  UiTheme,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { UsersService } from "../src/users/users.service";

function serviceHarness(
  options: { pendingRequests?: unknown[]; users?: unknown[]; total?: number } = {}
) {
  let countWhere: unknown = null;
  let findManyWhere: unknown = null;
  let findManyArgs: unknown = null;

  const prisma = {
    user: {
      count: (args: { where: unknown }) => {
        countWhere = args.where;
        return Promise.resolve(options.total ?? 0);
      },
      findMany: (args: { where: unknown }) => {
        findManyWhere = args.where;
        findManyArgs = args;
        return Promise.resolve(options.users ?? []);
      }
    },
    pickerBranchAssignment: {
      findMany: () =>
        Promise.resolve(relationItems(options.users ?? [], "pickerBranchAssignments", "pickerId"))
    },
    vendorChampAssignment: {
      findMany: () =>
        Promise.resolve(relationItems(options.users ?? [], "vendorChampAssignments", "champId"))
    },
    chainAreaManagerAssignment: {
      findMany: () =>
        Promise.resolve(
          relationItems(
            options.users ?? [],
            "chainAreaManagerAssignments",
            "areaManagerId"
          )
        )
    },
    request: {
      findMany: () => Promise.resolve(options.pendingRequests ?? [])
    },
    $transaction: (promises: Array<Promise<unknown>>) => Promise.all(promises)
  };

  return {
    service: new UsersService({} as never, prisma as never, {} as never),
    getCountWhere: () => countWhere,
    getFindManyWhere: () => findManyWhere,
    getFindManyArgs: () => findManyArgs
  };
}

function relationItems(users: unknown[], relationKey: string, userIdKey: string) {
  return users.flatMap((entry) => {
    const row = entry as Record<string, unknown>;
    const assignments = row[relationKey];

    if (!Array.isArray(assignments)) {
      return [];
    }

    return assignments.map((assignment) => ({
      ...(assignment as Record<string, unknown>),
      [userIdKey]: row.id
    }));
  });
}

const date = new Date("2025-01-01T00:00:00.000Z");

function user(id: string, role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ibsId: null,
    shopperId: null,
    role,
    nameEn: id,
    nameAr: null,
    phoneNumber: `010${id.replace(/\D/g, "").padEnd(8, "0").slice(0, 8)}`,
    nationalId: null,
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    uiTheme: UiTheme.ORANGE,
    joiningDate: null,
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
    createdAt: date,
    updatedAt: date,
    pickerBranchAssignments: [],
    vendorChampAssignments: [],
    chainAreaManagerAssignments: [],
    ...overrides
  };
}

function chain(id: string) {
  return {
    id,
    chainName: `${id} Chain`,
    chainCode: id.toUpperCase(),
    status: ChainStatus.ACTIVE,
    createdAt: date,
    updatedAt: date
  };
}

function vendor(
  id: string,
  chainValue: ReturnType<typeof chain>,
  champ: unknown = null
) {
  return {
    id,
    vendorName: `${id} Branch`,
    vendorCode: id.toUpperCase(),
    vendorExternalId: null,
    status: VendorStatus.ACTIVE,
    chainId: chainValue.id,
    address: null,
    area: null,
    city: null,
    createdAt: date,
    updatedAt: date,
    chain: chainValue,
    champAssignments: champ
      ? [
          {
            id: `${id}-champ-assignment`,
            status: AssignmentStatus.ACTIVE,
            champ
          }
        ]
      : []
  };
}

function assignment(
  id: string,
  status: AssignmentStatus,
  startDate: string,
  related: Record<string, unknown>
) {
  return {
    id,
    status,
    startDate: new Date(startDate),
    endDate: status === AssignmentStatus.ACTIVE ? null : new Date("2025-03-01"),
    updatedAt: new Date(startDate),
    ...related
  };
}

async function run() {
  {
    const harness = serviceHarness();
    await harness.service.list({
      page: 1,
      pageSize: 20,
      roles: "AREA_MANAGER,ADMIN,SUPER_ADMIN" as unknown as UserRole[]
    });

    assert.deepEqual(harness.getCountWhere(), harness.getFindManyWhere());
    assert.deepEqual(harness.getFindManyWhere(), {
      AND: [
        {
          role: {
            in: [UserRole.AREA_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN]
          }
        }
      ]
    });
  }

  {
    const harness = serviceHarness();
    await harness.service.list({
      page: 1,
      pageSize: 20,
      roles: [UserRole.PICKER, UserRole.CHAMP],
      chainId: "chain-1",
      vendorId: "vendor-1"
    });

    assert.deepEqual(harness.getCountWhere(), {
      AND: [
        { role: { in: [UserRole.PICKER, UserRole.CHAMP] } },
        {
          AND: [
            {
              OR: [
                {
                  role: UserRole.PICKER,
                  pickerBranchAssignments: {
                    some: {
                      status: AssignmentStatus.ACTIVE,
                      vendor: { chainId: "chain-1" }
                    }
                  }
                },
                {
                  role: UserRole.CHAMP,
                  vendorChampAssignments: {
                    some: {
                      status: AssignmentStatus.ACTIVE,
                      vendor: { chainId: "chain-1" }
                    }
                  }
                },
                {
                  role: UserRole.AREA_MANAGER,
                  chainAreaManagerAssignments: {
                    some: {
                      status: AssignmentStatus.ACTIVE,
                      chainId: "chain-1"
                    }
                  }
                }
              ]
            },
            {
              OR: [
                {
                  role: UserRole.PICKER,
                  pickerBranchAssignments: {
                    some: {
                      status: AssignmentStatus.ACTIVE,
                      vendorId: "vendor-1"
                    }
                  }
                },
                {
                  role: UserRole.CHAMP,
                  vendorChampAssignments: {
                    some: {
                      status: AssignmentStatus.ACTIVE,
                      vendorId: "vendor-1"
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    });
  }

  {
    const harness = serviceHarness();
    await harness.service.list({
      page: 1,
      pageSize: 20,
      role: UserRole.PICKER,
      areaManagerId: "area-manager-1",
      champId: "champ-1"
    });

    const serializedWhere = JSON.stringify(harness.getFindManyWhere());
    assert.match(serializedWhere, /area-manager-1/);
    assert.match(serializedWhere, /champ-1/);
    assert.match(serializedWhere, /pickerBranchAssignments/);
    assert.match(serializedWhere, /champAssignments/);
  }

  {
    const champ = user("champ-1", UserRole.CHAMP);
    const activeChain = chain("chain-active");
    const historicalChain = chain("chain-history");
    const activeVendor = vendor("vendor-active", activeChain, champ);
    const historicalVendor = vendor("vendor-history", historicalChain);
    const harness = serviceHarness({
      total: 2,
      users: [
        user("picker-active-wins", UserRole.PICKER, {
          pickerBranchAssignments: [
            assignment("older-active", AssignmentStatus.ACTIVE, "2025-01-01", {
              vendor: activeVendor
            }),
            assignment("newer-closed", AssignmentStatus.CLOSED, "2025-04-01", {
              vendor: historicalVendor
            })
          ]
        }),
        user("picker-history", UserRole.PICKER, {
          pickerBranchAssignments: [
            assignment("latest-closed", AssignmentStatus.CLOSED, "2025-05-01", {
              vendor: historicalVendor
            }),
            assignment("older-closed", AssignmentStatus.CLOSED, "2025-02-01", {
              vendor: activeVendor
            })
          ],
          employmentStatus: EmploymentStatus.RESIGNED,
          accountStatus: AccountStatus.ARCHIVED
        })
      ]
    });

    const result = await harness.service.listOperational({
      page: 1,
      pageSize: 20,
      role: UserRole.PICKER
    });

    assert.equal(result.items[0].assignment?.id, "older-active");
    assert.equal(result.items[0].vendor?.id, "vendor-active");
    assert.equal(result.items[0].chain?.id, "chain-active");
    assert.equal(result.items[0].champ?.id, "champ-1");
    assert.equal(result.items[1].assignment?.id, "latest-closed");
    assert.equal(result.items[1].vendor?.id, "vendor-history");
    assert.equal(result.items[1].chain?.id, "chain-history");
    assert.deepEqual(result.meta, {
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1
    });
  }

  {
    const activeChain = chain("chain-active");
    const activeVendor = vendor("vendor-active", activeChain);
    const harness = serviceHarness({
      total: 1,
      users: [
        user("picker-pending", UserRole.PICKER, {
          pickerBranchAssignments: [
            assignment("active-assignment", AssignmentStatus.ACTIVE, "2025-01-01", {
              vendor: activeVendor
            })
          ]
        })
      ],
      pendingRequests: [
        {
          id: "request-transfer-open",
          type: RequestType.TRANSFER,
          status: RequestStatus.PENDING_ADMIN,
          currentStep: "ADMIN_FINAL_APPROVAL",
          targetUserId: "picker-pending",
          createdAt: new Date("2025-05-01T00:00:00.000Z")
        }
      ]
    });

    const result = await harness.service.listOperational({
      page: 1,
      pageSize: 20,
      role: UserRole.PICKER
    });

    assert.deepEqual(result.items[0].pendingRequest, {
      id: "request-transfer-open",
      type: RequestType.TRANSFER,
      status: RequestStatus.PENDING_ADMIN,
      currentStep: "ADMIN_FINAL_APPROVAL",
      createdAt: new Date("2025-05-01T00:00:00.000Z")
    });
  }
}

void run();
