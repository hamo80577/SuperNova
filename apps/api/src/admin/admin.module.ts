import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
