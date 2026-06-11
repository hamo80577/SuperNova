import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AccessControlModule } from "../access-control/access-control.module";
import { UsersModule } from "../users/users.module";
import { RequestApprovalRoutingService } from "../requests/request-approval-routing.service";
import { DeductionPolicyService } from "./deduction-policy.service";
import { DeductionsController } from "./deductions.controller";
import { DeductionsScopeService } from "./deductions-scope.service";
import { DeductionsService } from "./deductions.service";

@Module({
  controllers: [DeductionsController],
  imports: [AccessControlModule, JwtModule.register({}), UsersModule],
  providers: [
    DeductionPolicyService,
    DeductionsScopeService,
    DeductionsService,
    RequestApprovalRoutingService
  ],
  exports: [DeductionsService]
})
export class DeductionsModule {}
