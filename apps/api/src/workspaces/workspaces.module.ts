import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { DashboardCacheModule } from "../dashboard-cache/dashboard-cache.module";
import { OrdersKpisModule } from "../orders-kpis/orders-kpis.module";
import { UsersModule } from "../users/users.module";
import { AreaManagerPerformanceSummaryService } from "./area-manager-performance-summary.service";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

@Module({
  controllers: [WorkspacesController],
  imports: [
    DashboardCacheModule,
    JwtModule.register({}),
    OrdersKpisModule,
    UsersModule
  ],
  providers: [WorkspacesService, AreaManagerPerformanceSummaryService],
  exports: [WorkspacesService, AreaManagerPerformanceSummaryService]
})
export class WorkspacesModule {}
