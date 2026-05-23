import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AccessControlModule } from "../access-control/access-control.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RequestsModule } from "../requests/requests.module";
import { UsersModule } from "../users/users.module";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  controllers: [ApprovalsController],
  imports: [
    AccessControlModule,
    AuditModule,
    JwtModule.register({}),
    NotificationsModule,
    RequestsModule,
    UsersModule
  ],
  providers: [ApprovalsService],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
