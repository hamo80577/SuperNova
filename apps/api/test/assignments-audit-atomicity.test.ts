import assert from "node:assert/strict";

import {
  AccountStatus,
  AssignmentStatus,
  BlockStatus,
  ChainStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { AssignmentsService } from "../src/assignments/assignments.service";

const now = new Date("2026-06-23T10:00:00.000Z");
const auditFailure = new Error("audit unavailable");

type Store = ReturnType<typeof assignmentStore>;

function user(role: UserRole, id: string) {
  return {
    id,
    ibsId: null,
    shopperId: null,
    role,
    nameEn: role,
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
    updatedAt: now
  } as any;
}

function chain() {
  return {
    id: "chain-1",
    chainName: "Chain 1",
    chainCode: "CHAIN-1",
    status: ChainStatus.ACTIVE,
    createdAt: now,
    updatedAt: now
  } as any;
}

function vendor(store: Store) {
  return {
    id: "vendor-1",
    vendorName: "Vendor 1",
    vendorCode: "VENDOR-1",
    vendorExternalId: null,
    status: VendorStatus.ACTIVE,
    chainId: store.chain.id,
    area: null,
    city: null,
    createdAt: now,
    updatedAt: now,
    chain: store.chain
  } as any;
}

function vendorChampAssignment(store: Store) {
  return {
    id: "vendor-champ-assignment-1",
    vendorId: store.vendor.id,
    champId: store.champ.id,
    status: AssignmentStatus.ACTIVE,
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    vendor: store.vendor,
    champ: store.champ
  } as any;
}

function chainAreaManagerAssignment(store: Store) {
  return {
    id: "chain-area-manager-assignment-1",
    chainId: store.chain.id,
    areaManagerId: store.areaManager.id,
    status: AssignmentStatus.ACTIVE,
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    chain: store.chain,
    areaManager: store.areaManager
  } as any;
}

function assignmentStore() {
  const store = {
    chain: chain(),
    champ: user(UserRole.CHAMP, "champ-1"),
    areaManager: user(UserRole.AREA_MANAGER, "area-manager-1"),
    vendor: null as any,
    vendorChampAssignments: [] as any[],
    chainAreaManagerAssignments: [] as any[]
  };

  store.vendor = vendor(store);

  return store;
}

function cloneRows(rows: any[]) {
  return rows.map((row) => ({ ...row }));
}

function restoreRows(target: any[], snapshot: any[]) {
  target.length = 0;
  target.push(...cloneRows(snapshot));
}

function createPrisma(store: Store) {
  const createVendorChampAssignment = async (args: any) => {
    const assignment = {
      ...vendorChampAssignment(store),
      id: `vendor-champ-assignment-${store.vendorChampAssignments.length + 1}`,
      ...args.data,
      vendor: store.vendor,
      champ: store.champ
    };
    store.vendorChampAssignments.push(assignment);
    return assignment;
  };

  const updateVendorChampAssignment = async (args: any) => {
    const assignment = store.vendorChampAssignments.find(
      (row) => row.id === args.where.id
    );

    if (!assignment) {
      throw new Error("vendor champ assignment missing");
    }

    Object.assign(assignment, args.data, { updatedAt: now });
    return assignment;
  };

  const createChainAreaManagerAssignment = async (args: any) => {
    const assignment = {
      ...chainAreaManagerAssignment(store),
      id: `chain-area-manager-assignment-${store.chainAreaManagerAssignments.length + 1}`,
      ...args.data,
      chain: store.chain,
      areaManager: store.areaManager
    };
    store.chainAreaManagerAssignments.push(assignment);
    return assignment;
  };

  const updateChainAreaManagerAssignment = async (args: any) => {
    const assignment = store.chainAreaManagerAssignments.find(
      (row) => row.id === args.where.id
    );

    if (!assignment) {
      throw new Error("chain area manager assignment missing");
    }

    Object.assign(assignment, args.data, { updatedAt: now });
    return assignment;
  };

  const prisma = {
    vendor: {
      findUnique: async () => store.vendor
    },
    chain: {
      findUnique: async () => store.chain
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (where.id === store.champ.id) return store.champ;
        if (where.id === store.areaManager.id) return store.areaManager;
        return null;
      }
    },
    vendorChampAssignment: {
      findFirst: async ({ where }: any) =>
        store.vendorChampAssignments.find(
          (row) => row.vendorId === where.vendorId && row.status === where.status
        ) ?? null,
      findUnique: async ({ where }: any) =>
        store.vendorChampAssignments.find((row) => row.id === where.id) ?? null,
      create: createVendorChampAssignment,
      update: updateVendorChampAssignment
    },
    chainAreaManagerAssignment: {
      findFirst: async ({ where }: any) =>
        store.chainAreaManagerAssignments.find(
          (row) => row.chainId === where.chainId && row.status === where.status
        ) ?? null,
      findUnique: async ({ where }: any) =>
        store.chainAreaManagerAssignments.find((row) => row.id === where.id) ??
        null,
      create: createChainAreaManagerAssignment,
      update: updateChainAreaManagerAssignment
    },
    auditLog: {
      create: async () => {
        throw auditFailure;
      }
    },
    $transaction: async (operation: unknown) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }

      const vendorChampSnapshot = cloneRows(store.vendorChampAssignments);
      const chainAreaManagerSnapshot = cloneRows(
        store.chainAreaManagerAssignments
      );

      try {
        return await (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
      } catch (error) {
        restoreRows(store.vendorChampAssignments, vendorChampSnapshot);
        restoreRows(
          store.chainAreaManagerAssignments,
          chainAreaManagerSnapshot
        );
        throw error;
      }
    }
  };

  return prisma;
}

function createService(store: Store) {
  return new AssignmentsService(createPrisma(store) as any);
}

async function run() {
  {
    const store = assignmentStore();

    await assert.rejects(
      () =>
        createService(store).createVendorChampAssignment(
          {
            vendorId: store.vendor.id,
            champId: store.champ.id,
            startDate: "2026-06-23"
          },
          { actorUserId: "admin-1", ipAddress: "127.0.0.1" }
        ),
      /audit unavailable/
    );

    assert.equal(store.vendorChampAssignments.length, 0);
  }

  {
    const store = assignmentStore();
    store.vendorChampAssignments.push(vendorChampAssignment(store));

    await assert.rejects(
      () =>
        createService(store).closeVendorChampAssignment(
          "vendor-champ-assignment-1",
          { endDate: "2026-06-30" },
          { actorUserId: "admin-1", userAgent: "test" }
        ),
      /audit unavailable/
    );

    assert.equal(
      store.vendorChampAssignments[0].status,
      AssignmentStatus.ACTIVE
    );
    assert.equal(store.vendorChampAssignments[0].endDate, null);
  }

  {
    const store = assignmentStore();

    await assert.rejects(
      () =>
        createService(store).createChainAreaManagerAssignment(
          {
            chainId: store.chain.id,
            areaManagerId: store.areaManager.id,
            startDate: "2026-06-23"
          },
          { actorUserId: "admin-1", ipAddress: "127.0.0.1" }
        ),
      /audit unavailable/
    );

    assert.equal(store.chainAreaManagerAssignments.length, 0);
  }

  {
    const store = assignmentStore();
    store.chainAreaManagerAssignments.push(chainAreaManagerAssignment(store));

    await assert.rejects(
      () =>
        createService(store).closeChainAreaManagerAssignment(
          "chain-area-manager-assignment-1",
          { endDate: "2026-06-30" },
          { actorUserId: "admin-1", userAgent: "test" }
        ),
      /audit unavailable/
    );

    assert.equal(
      store.chainAreaManagerAssignments[0].status,
      AssignmentStatus.ACTIVE
    );
    assert.equal(store.chainAreaManagerAssignments[0].endDate, null);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
