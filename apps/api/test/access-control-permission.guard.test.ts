import assert from "node:assert/strict";

import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AccountStatus,
  EmploymentStatus,
  ProfileStatus,
  UserRole
} from "@prisma/client";

import {
  AccessPolicyService,
  PermissionGuard,
  PermissionKeys,
  REQUIRED_PERMISSION_KEY,
  type PermissionKey
} from "../src/access-control";
import type { AuthenticatedUser } from "../src/auth/types/authenticated-user";

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

function executionContext(params: {
  handler: () => void;
  controllerClass: object;
  user?: AuthenticatedUser;
}): ExecutionContext {
  return {
    getHandler: () => params.handler,
    getClass: () => params.controllerClass,
    switchToHttp: () => ({
      getRequest: () => ({
        user: params.user
      })
    })
  } as ExecutionContext;
}

function createPolicyRecorder(params: { shouldThrow?: boolean } = {}) {
  const calls: Array<{ actor: AuthenticatedUser; permissionKey: PermissionKey }> = [];

  return {
    calls,
    policy: {
      assertCan: (policyActor: AuthenticatedUser, permissionKey: PermissionKey) => {
        calls.push({ actor: policyActor, permissionKey });

        if (params.shouldThrow) {
          throw new ForbiddenException("Missing required permission.");
        }
      }
    } as AccessPolicyService
  };
}

class TestController {}

const handlerWithoutMetadata = () => undefined;
const handlerWithMetadata = () => undefined;
Reflect.defineMetadata(
  REQUIRED_PERMISSION_KEY,
  PermissionKeys.ACCESS_CONTROL_VIEW,
  handlerWithMetadata
);

const reflector = new Reflector();
const user = actor(UserRole.SUPER_ADMIN);

const noMetadataRecorder = createPolicyRecorder();
const noMetadataGuard = new PermissionGuard(
  reflector,
  noMetadataRecorder.policy
);
const noMetadataResult = noMetadataGuard.canActivate(
  executionContext({
    handler: handlerWithoutMetadata,
    controllerClass: TestController,
    user
  })
);

assert.equal(noMetadataResult, true);
assert.deepEqual(noMetadataRecorder.calls, []);

const missingUserGuard = new PermissionGuard(
  reflector,
  createPolicyRecorder().policy
);
assert.throws(
  () =>
    missingUserGuard.canActivate(
      executionContext({
        handler: handlerWithMetadata,
        controllerClass: TestController
      })
    ),
  ForbiddenException
);

const allowingRecorder = createPolicyRecorder();
const allowingGuard = new PermissionGuard(reflector, allowingRecorder.policy);
const allowedResult = allowingGuard.canActivate(
  executionContext({
    handler: handlerWithMetadata,
    controllerClass: TestController,
    user
  })
);

assert.equal(allowedResult, true);
assert.deepEqual(allowingRecorder.calls, [
  {
    actor: user,
    permissionKey: PermissionKeys.ACCESS_CONTROL_VIEW
  }
]);
assert.equal(
  typeof (allowedResult as unknown as { then?: unknown }).then,
  "undefined"
);

const denyingGuard = new PermissionGuard(
  reflector,
  createPolicyRecorder({ shouldThrow: true }).policy
);
assert.throws(
  () =>
    denyingGuard.canActivate(
      executionContext({
        handler: handlerWithMetadata,
        controllerClass: TestController,
        user
      })
    ),
  ForbiddenException
);
