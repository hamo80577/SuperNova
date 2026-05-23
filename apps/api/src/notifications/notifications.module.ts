import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AccessControlModule } from "../access-control/access-control.module";
import { UsersModule } from "../users/users.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  imports: [AccessControlModule, JwtModule.register({}), UsersModule],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
