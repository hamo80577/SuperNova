import assert from "node:assert/strict";

import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UiTheme,
  UserRole
} from "@prisma/client";

import {
  AccessRoleAssignmentService,
  AccessPolicyService,
  PermissionKeys,
  type PermissionKey
} from "../src/access-control";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { AuthenticatedRequest } from "../src/auth/types/authenticated-request";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";
import type { UpdateAdminProfileDto } from "../src/users/dto/admin-profile.dto";
import type { AreaManagerChainAssignmentDto } from "../src/users/dto/area-manager-chain-assignment.dto";
import type { ListUsersQueryDto } from "../src/users/dto/list-users-query.dto";
import type { UpdateProfileCompletionDto } from "../src/users/dto/profile-completion.dto";
import type { UpdateUserPreferencesDto } from "../src/users/dto/user-preferences.dto";
import { UsersController } from "../src/users/users.controller";
import type { UsersService } from "../src/users/users.service";

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

function requestFor(user: AuthenticatedUser): AuthenticatedRequest {
  return {
    user,
    cookies: {},
    ip: "127.0.0.1",
    headers: { "user-agent": "users-access-policy-test" }
  } as AuthenticatedRequest;
}

function rolesFor(methodName: keyof UsersController) {
  return Reflect.getMetadata(ROLES_KEY, UsersController.prototype[methodName]);
}

const serviceCalls: string[] = [];
const responses = {
  me: { id: "current-user" },
  list: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
  operationalList: {
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
  },
  operationalProfile: { user: { id: "target-user" } },
  preferences: { user: { id: "current-user", uiTheme: UiTheme.TEAL } },
  areaManagerAssignments: { assignments: [] },
  adminProfile: { user: { id: "target-user" } },
  temporaryPassword: { temporaryPassword: "redacted" },
  resetTemporaryPassword: { temporaryPassword: "redacted-reset" },
  profileCompletion: { user: { id: "current-user" } },
  updatedProfileCompletion: { user: { id: "current-user" } }
};

const usersService = {
  getSafeCurrentUser: async (userId: string) => {
    serviceCalls.push(`get-me:${userId}`);
    return responses.me;
  },
  getOperationalProfile: async (
    targetUserId: string,
    currentUser: AuthenticatedUser
  ) => {
    serviceCalls.push(`operational-profile:${targetUserId}:${currentUser.id}`);
    return responses.operationalProfile;
  },
  list: async (query: ListUsersQueryDto) => {
    serviceCalls.push(`list:${query.page}:${query.role ?? "none"}`);
    return responses.list;
  },
  listOperational: async (query: ListUsersQueryDto) => {
    serviceCalls.push(`operational-list:${query.page}:${query.role ?? "none"}`);
    return responses.operationalList;
  },
  updatePreferences: async (
    userId: string,
    dto: UpdateUserPreferencesDto,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `preferences:${userId}:${dto.uiTheme}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.preferences;
  },
  revealTemporaryPassword: async (
    targetUserId: string,
    currentUser: AuthenticatedUser,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `reveal-password:${targetUserId}:${currentUser.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.temporaryPassword;
  },
  resetTemporaryPassword: async (
    targetUserId: string,
    currentUser: AuthenticatedUser,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `reset-password:${targetUserId}:${currentUser.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.resetTemporaryPassword;
  },
  getAreaManagerChainAssignments: async (targetUserId: string) => {
    serviceCalls.push(`area-manager-chain-assignments:${targetUserId}`);
    return responses.areaManagerAssignments;
  },
  addAreaManagerChainAssignments: async (
    targetUserId: string,
    dto: AreaManagerChainAssignmentDto,
    currentUser: AuthenticatedUser,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `add-area-manager-chain-assignments:${targetUserId}:${dto.chainIds.join(",")}:${currentUser.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.areaManagerAssignments;
  },
  removeAreaManagerChainAssignment: async (
    targetUserId: string,
    assignmentId: string,
    currentUser: AuthenticatedUser,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `remove-area-manager-chain-assignment:${targetUserId}:${assignmentId}:${currentUser.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.areaManagerAssignments;
  },
  updateAdminProfile: async (
    targetUserId: string,
    dto: UpdateAdminProfileDto,
    currentUser: AuthenticatedUser,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `admin-profile:${targetUserId}:${dto.nameEn ?? "none"}:${currentUser.id}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.adminProfile;
  },
  getProfileCompletion: async (userId: string) => {
    serviceCalls.push(`profile-completion:${userId}`);
    return responses.profileCompletion;
  },
  updateProfileCompletion: async (
    userId: string,
    dto: UpdateProfileCompletionDto,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ) => {
    serviceCalls.push(
      `update-profile-completion:${userId}:${dto.nameEn ?? "none"}:${context.ipAddress}:${context.userAgent}`
    );
    return responses.updatedProfileCompletion;
  }
} as unknown as UsersService;

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
  const controller = new UsersController(
    usersService,
    recordingPolicy,
    {} as AccessRoleAssignmentService
  );
  const admin = actor(UserRole.ADMIN);
  const champ = actor(UserRole.CHAMP);
  const picker = actor(UserRole.PICKER);
  const listQuery = { page: 2, role: UserRole.CHAMP } satisfies ListUsersQueryDto;

  assert.deepEqual(rolesFor("list"), [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
  assert.deepEqual(rolesFor("listOperational"), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("updateAdminProfile"), [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ]);
  assert.deepEqual(rolesFor("getProfileCompletion"), [UserRole.PICKER]);
  assert.deepEqual(rolesFor("updateProfileCompletion"), [UserRole.PICKER]);

  assert.equal(await controller.getMe(champ), responses.me);
  assert.equal(
    await controller.getOperationalProfile("target-user", champ),
    responses.operationalProfile
  );
  assert.equal(await controller.list(admin, listQuery), responses.list);
  assert.equal(
    await controller.listOperational(admin, listQuery),
    responses.operationalList
  );

  assert.deepEqual(policyCalls, [
    {
      actor: champ,
      permissionKey: PermissionKeys.USERS_VIEW_SELF
    },
    {
      actor: champ,
      permissionKey: PermissionKeys.USERS_VIEW_OPERATIONAL_PROFILE
    },
    { actor: admin, permissionKey: PermissionKeys.USERS_LIST_OPERATIONAL },
    { actor: admin, permissionKey: PermissionKeys.USERS_LIST_OPERATIONAL }
  ]);

  assert.deepEqual(serviceCalls, [
    `get-me:${champ.id}`,
    `operational-profile:target-user:${champ.id}`,
    "list:2:CHAMP",
    "operational-list:2:CHAMP"
  ]);

  policyCalls.length = 0;
  serviceCalls.length = 0;

  const request = requestFor(admin);

  assert.equal(
    await controller.updatePreferences(
      admin,
      { uiTheme: UiTheme.TEAL },
      request
    ),
    responses.preferences
  );

  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_EDIT_OWN_PREFERENCES
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `preferences:${admin.id}:TEAL:127.0.0.1:users-access-policy-test`
  ]);

  policyCalls.length = 0;
  serviceCalls.length = 0;

  assert.equal(
    await controller.revealTemporaryPassword("target-user", admin, request),
    responses.temporaryPassword
  );
  assert.equal(
    await controller.resetTemporaryPassword("target-user", admin, request),
    responses.resetTemporaryPassword
  );

  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_READ_TEMPORARY_PASSWORD
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_MANAGE_TEMPORARY_PASSWORD
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `reveal-password:target-user:${admin.id}:127.0.0.1:users-access-policy-test`,
    `reset-password:target-user:${admin.id}:127.0.0.1:users-access-policy-test`
  ]);

  policyCalls.length = 0;
  serviceCalls.length = 0;

  assert.equal(
    await controller.getAreaManagerChainAssignments("area-manager-user", admin),
    responses.areaManagerAssignments
  );
  assert.equal(
    await controller.addAreaManagerChainAssignments(
      "area-manager-user",
      { chainIds: ["chain-1"] },
      admin,
      request
    ),
    responses.areaManagerAssignments
  );
  assert.equal(
    await controller.removeAreaManagerChainAssignment(
      "area-manager-user",
      "assignment-1",
      admin,
      request
    ),
    responses.areaManagerAssignments
  );

  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS
    },
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_MANAGE_AREA_MANAGER_CHAIN_ASSIGNMENTS
    }
  ]);
  assert.deepEqual(serviceCalls, [
    "area-manager-chain-assignments:area-manager-user",
    `add-area-manager-chain-assignments:area-manager-user:chain-1:${admin.id}:127.0.0.1:users-access-policy-test`,
    `remove-area-manager-chain-assignment:area-manager-user:assignment-1:${admin.id}:127.0.0.1:users-access-policy-test`
  ]);

  policyCalls.length = 0;
  serviceCalls.length = 0;

  assert.equal(
    await controller.updateAdminProfile(
      "target-user",
      { nameEn: "Target User" },
      admin,
      request
    ),
    responses.adminProfile
  );
  assert.equal(
    await controller.getProfileCompletion(picker),
    responses.profileCompletion
  );
  assert.equal(
    await controller.updateProfileCompletion(
      picker,
      { nameEn: "Picker User" },
      requestFor(picker)
    ),
    responses.updatedProfileCompletion
  );

  assert.deepEqual(policyCalls, [
    {
      actor: admin,
      permissionKey: PermissionKeys.USERS_EDIT_PROFILE
    },
    {
      actor: picker,
      permissionKey: PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE
    },
    {
      actor: picker,
      permissionKey: PermissionKeys.USERS_COMPLETE_OWN_PICKER_PROFILE
    }
  ]);
  assert.deepEqual(serviceCalls, [
    `admin-profile:target-user:Target User:${admin.id}:127.0.0.1:users-access-policy-test`,
    `profile-completion:${picker.id}`,
    `update-profile-completion:${picker.id}:Picker User:127.0.0.1:users-access-policy-test`
  ]);
}

void run();
