import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
