import { ForbiddenException, Injectable } from "@nestjs/common";

import { roleHasPermission } from "./role-permission.matrix";
import type {
  AccessPolicyActor,
  AccessPolicyContext
} from "./access-policy.types";
import type { PermissionKey } from "./permissions";

@Injectable()
export class AccessPolicyService {
  hasPermission(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey
  ): boolean {
    return roleHasPermission(actor.role, permissionKey);
  }

  can(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey,
    context?: AccessPolicyContext
  ): boolean {
    void context;
    return this.hasPermission(actor, permissionKey);
  }

  assertCan(
    actor: AccessPolicyActor,
    permissionKey: PermissionKey,
    context?: AccessPolicyContext
  ): void {
    if (!this.can(actor, permissionKey, context)) {
      throw new ForbiddenException("Missing required permission.");
    }
  }
}
