import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import {
  AccessPolicyService,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
import { ReportsController } from "../src/reports/reports.controller";
import type { ReportsService } from "../src/reports/reports.service";

function actor(role: UserRole): AuthenticatedUser {
  return {
    id: `actor-${role.toLowerCase()}`,
    role,
    nameEn: role,
    phoneNumber: "01000000000",
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    mustChangePassword: false
  };
}

function rolesFor(methodName: keyof ReportsController) {
  return Reflect.getMetadata(
    ROLES_KEY,
    ReportsController.prototype[methodName]
  );
}

const serviceCalls: string[] = [];
const responses = {
  admin: { scopeSummary: { scope: "SYSTEM" } },
  areaManager: { scopeSummary: { assignedChains: 1 } },
  champ: { scopeSummary: { assignedBranches: 1 } }
};

const reportsService = {
  getAdminOverview: async () => {
    serviceCalls.push("admin");
    return responses.admin;
  },
  getAreaManagerOverview: async (areaManagerId: string) => {
    serviceCalls.push(`area-manager:${areaManagerId}`);
    return responses.areaManager;
  },
  getChampOverview: async (champId: string) => {
    serviceCalls.push(`champ:${champId}`);
    return responses.champ;
  }
} as ReportsService;

const policyCalls: Array<{
  actor: AuthenticatedUser;
  permissionKey: PermissionKey;
}> = [];

const recordingPolicy = {
  assertCan: (policyActor: AuthenticatedUser, permissionKey: PermissionKey) => {
    policyCalls.push({ actor: policyActor, permissionKey });
  }
} as AccessPolicyService;

async function run() {
  const controller = new ReportsController(reportsService, recordingPolicy);

  assert.deepEqual(rolesFor("getAdminOverview"), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("getAreaManagerOverview"), [UserRole.AREA_MANAGER]);
  assert.deepEqual(rolesFor("getChampOverview"), [UserRole.CHAMP]);

  const admin = actor(UserRole.ADMIN);
  const superAdmin = actor(UserRole.SUPER_ADMIN);
  const areaManager = actor(UserRole.AREA_MANAGER);
  const champ = actor(UserRole.CHAMP);

  assert.equal(await controller.getAdminOverview(admin), responses.admin);
  assert.equal(await controller.getAdminOverview(superAdmin), responses.admin);
  assert.equal(
    await controller.getAreaManagerOverview(areaManager),
    responses.areaManager
  );
  assert.equal(await controller.getChampOverview(champ), responses.champ);

  assert.deepEqual(policyCalls, [
    { actor: admin, permissionKey: PermissionKeys.REPORTS_VIEW_ADMIN },
    { actor: superAdmin, permissionKey: PermissionKeys.REPORTS_VIEW_ADMIN },
    {
      actor: areaManager,
      permissionKey: PermissionKeys.REPORTS_VIEW_AREA_MANAGER
    },
    { actor: champ, permissionKey: PermissionKeys.REPORTS_VIEW_CHAMP }
  ]);

  assert.deepEqual(serviceCalls, [
    "admin",
    "admin",
    `area-manager:${areaManager.id}`,
    `champ:${champ.id}`
  ]);

  const realPolicyController = new ReportsController(
    reportsService,
    new AccessPolicyService()
  );

  await assert.doesNotReject(() => realPolicyController.getAdminOverview(admin));
  await assert.doesNotReject(() =>
    realPolicyController.getAdminOverview(superAdmin)
  );
  await assert.doesNotReject(() =>
    realPolicyController.getAreaManagerOverview(areaManager)
  );
  await assert.doesNotReject(() => realPolicyController.getChampOverview(champ));

  await assert.rejects(
    async () => realPolicyController.getAdminOverview(champ),
    /Missing required permission/
  );
  await assert.rejects(
    async () => realPolicyController.getAdminOverview(areaManager),
    /Missing required permission/
  );
  await assert.rejects(
    async () => realPolicyController.getAreaManagerOverview(admin),
    /Missing required permission/
  );
  await assert.rejects(
    async () => realPolicyController.getChampOverview(admin),
    /Missing required permission/
  );
}

void run();
