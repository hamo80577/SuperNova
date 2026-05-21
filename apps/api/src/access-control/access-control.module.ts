import { Module } from "@nestjs/common";

import { AccessControlController } from "./access-control.controller";
import { AccessPolicyService } from "./access-policy.service";

@Module({
  controllers: [AccessControlController],
  providers: [AccessPolicyService],
  exports: [AccessPolicyService]
})
export class AccessControlModule {}
