import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { TemporaryPasswordService } from "./temporary-password.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [JwtModule.register({}), AuditModule],
  controllers: [UsersController],
  providers: [TemporaryPasswordService, UsersService],
  exports: [TemporaryPasswordService, UsersService]
})
export class UsersModule {}
