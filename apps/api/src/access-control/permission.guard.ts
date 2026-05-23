import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AccessPolicyService } from "./access-policy.service";
import {
  REQUIRED_PERMISSION_KEY
} from "./require-permission.decorator";
import type { PermissionKey } from "./permissions";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessPolicyService)
    private readonly accessPolicy: AccessPolicyService
  ) {}

  canActivate(context: ExecutionContext) {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionKey>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new ForbiddenException("You do not have permission for this action.");
    }

    this.accessPolicy.assertCan(request.user, requiredPermission);
    return true;
  }
}
