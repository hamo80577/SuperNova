import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import Redis from "ioredis";

import { redisConnectionFromUrl } from "../import-jobs/redis-connection";
import { DashboardCacheReadThroughService } from "./dashboard-cache-read-through.service";
import { DASHBOARD_CACHE_QUEUE } from "./dashboard-cache.constants";
import { DashboardCacheQueueService } from "./dashboard-cache-queue.service";
import {
  DASHBOARD_CACHE_REDIS,
  DashboardCacheStoreService
} from "./dashboard-cache-store.service";

@Global()
@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: DASHBOARD_CACHE_QUEUE })],
  providers: [
    {
      provide: DASHBOARD_CACHE_REDIS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis({
          ...redisConnectionFromUrl(
            configService.get<string>("imports.redisUrl") ??
              "redis://localhost:6379"
          ),
          lazyConnect: true,
          maxRetriesPerRequest: 1
        })
    },
    DashboardCacheStoreService,
    DashboardCacheReadThroughService,
    DashboardCacheQueueService
  ],
  exports: [
    DashboardCacheStoreService,
    DashboardCacheReadThroughService,
    DashboardCacheQueueService
  ]
})
export class DashboardCacheModule {}
