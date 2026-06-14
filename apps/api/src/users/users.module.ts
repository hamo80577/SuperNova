import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AccessControlModule } from "../access-control/access-control.module";
import { AuditModule } from "../audit/audit.module";
import { AnnualLeaveBalanceService } from "./annual-leave-balance.service";
import { TemporaryPasswordService } from "./temporary-password.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    forwardRef(() => AccessControlModule),
    JwtModule.register({}),
    AuditModule
  ],
  controllers: [UsersController],
  providers: [TemporaryPasswordService, AnnualLeaveBalanceService, UsersService],
  exports: [TemporaryPasswordService, AnnualLeaveBalanceService, UsersService]
})
export class UsersModule {}
