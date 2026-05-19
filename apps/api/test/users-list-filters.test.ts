import assert from "node:assert/strict";

import { AssignmentStatus, UserRole } from "@prisma/client";

import { UsersService } from "../src/users/users.service";

function serviceHarness() {
  let countWhere: unknown = null;
  let findManyWhere: unknown = null;

  const prisma = {
    user: {
      count: (args: { where: unknown }) => {
        countWhere = args.where;
        return Promise.resolve(0);
      },
      findMany: (args: { where: unknown }) => {
        findManyWhere = args.where;
        return Promise.resolve([]);
      }
    },
    $transaction: (promises: Array<Promise<unknown>>) => Promise.all(promises)
  };

  return {
    service: new UsersService({} as never, prisma as never, {} as never),
    getCountWhere: () => countWhere,
    getFindManyWhere: () => findManyWhere
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
}

void run();
