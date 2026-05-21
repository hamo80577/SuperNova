import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { AccessControlController } from "./access-control.controller";
import { AccessPolicyService } from "./access-policy.service";

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [AccessControlController],
  providers: [AccessPolicyService],
  exports: [AccessPolicyService]
})
export class AccessControlModule {}
