import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { AccessControlController } from "./access-control.controller";
import { AccessRoleAssignmentService } from "./access-role-assignment.service";
import { AccessRoleService } from "./access-role.service";
import { AccessPolicyService } from "./access-policy.service";

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UsersModule)],
  controllers: [AccessControlController],
  providers: [
    AccessPolicyService,
    AccessRoleService,
    AccessRoleAssignmentService
  ],
  exports: [AccessPolicyService, AccessRoleService, AccessRoleAssignmentService]
})
export class AccessControlModule {}
