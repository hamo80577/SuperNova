import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UserRole } from "@prisma/client";
import type Redis from "ioredis";

import { DASHBOARD_CACHE_DEFAULT_TTL_SECONDS } from "./dashboard-cache.constants";
import { dashboardPerformanceCacheKey } from "./dashboard-cache-key";
import type { DashboardCacheWriteEntry } from "./dashboard-cache.types";

export const DASHBOARD_CACHE_REDIS = Symbol("DASHBOARD_CACHE_REDIS");

@Injectable()
export class DashboardCacheStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(DashboardCacheStoreService.name);
  private readonly ttlSeconds: number;

  constructor(
    @Inject(DASHBOARD_CACHE_REDIS) private readonly redis: Redis,
    @Inject(ConfigService) configService: ConfigService
  ) {
    this.ttlSeconds =
      configService.get<number>("dashboardCache.ttlSeconds") ??
      DASHBOARD_CACHE_DEFAULT_TTL_SECONDS;
  }

  async get<T>(role: UserRole, userId: string, month: string) {
    const key = dashboardPerformanceCacheKey(role, userId, month);

    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        this.logger.warn(`Discarding malformed dashboard cache value for ${key}.`);
        await this.delete(role, userId, month);
        return null;
      }
    } catch (error) {
      this.logger.warn(`Dashboard cache read failed for ${key}: ${errorMessage(error)}`);
      return null;
    }
  }

  async delete(role: UserRole, userId: string, month: string) {
    const key = dashboardPerformanceCacheKey(role, userId, month);

    try {
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      const commandResults = await pipeline.exec();
      const succeeded = pipelineCommandsSucceeded(commandResults);
      if (!succeeded) {
        this.logger.warn(`Dashboard cache invalidation command failed for ${key}.`);
      }
      return succeeded;
    } catch (error) {
      this.logger.warn(
        `Dashboard cache invalidation failed for ${key}: ${errorMessage(error)}`
      );
      return false;
    }
  }

  async writeMany(entries: DashboardCacheWriteEntry[]) {
    if (entries.length === 0) {
      return true;
    }

    try {
      const pipeline = this.redis.pipeline();
      for (const entry of entries) {
        pipeline.set(
          dashboardPerformanceCacheKey(
            entry.role,
            entry.userId,
            entry.month
          ),
          JSON.stringify(entry.summary),
          "EX",
          this.ttlSeconds
        );
      }
      const commandResults = await pipeline.exec();
      const succeeded = pipelineCommandsSucceeded(commandResults);
      if (!succeeded) {
        this.logger.warn("Dashboard cache pipeline returned a command error.");
      }
      return succeeded;
    } catch (error) {
      this.logger.warn(
        `Dashboard cache pipeline write failed: ${errorMessage(error)}`
      );
      return false;
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Redis error.";
}

function pipelineCommandsSucceeded(
  commandResults: Array<[Error | null, unknown]> | null
) {
  return (
    commandResults !== null &&
    commandResults.every(([commandError]) => commandError === null)
  );
}
