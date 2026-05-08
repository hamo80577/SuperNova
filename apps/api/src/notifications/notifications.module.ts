import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  imports: [JwtModule.register({}), UsersModule],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
