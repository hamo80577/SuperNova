import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RequestsModule } from "../requests/requests.module";
import { UsersModule } from "../users/users.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    AuditModule,
    JwtModule.register({}),
    NotificationsModule,
    RequestsModule,
    UsersModule
  ],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
