import { Module } from "@nestjs/common";

import { WorkspacesModule } from "../workspaces/workspaces.module";
import { DashboardCacheModule } from "./dashboard-cache.module";
import { DashboardCacheProcessor } from "./dashboard-cache.processor";
import { DashboardCacheWarmerService } from "./dashboard-cache-warmer.service";

@Module({
  imports: [DashboardCacheModule, WorkspacesModule],
  providers: [DashboardCacheWarmerService, DashboardCacheProcessor]
})
export class DashboardCacheWorkerModule {}
