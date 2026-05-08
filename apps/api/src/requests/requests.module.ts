import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";

@Module({
  controllers: [RequestsController],
  imports: [AuditModule, JwtModule.register({}), NotificationsModule, UsersModule],
  providers: [RequestsService],
  exports: [RequestsService]
})
export class RequestsModule {}
