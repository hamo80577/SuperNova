import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { VendorsController } from "./vendors.controller";
import { VendorsService } from "./vendors.service";

@Module({
  imports: [AuditModule, JwtModule.register({}), UsersModule],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService]
})
export class VendorsModule {}
