import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { ChainsController } from "./chains.controller";
import { ChainsService } from "./chains.service";

@Module({
  imports: [AuditModule, JwtModule.register({}), UsersModule],
  controllers: [ChainsController],
  providers: [ChainsService],
  exports: [ChainsService]
})
export class ChainsModule {}
