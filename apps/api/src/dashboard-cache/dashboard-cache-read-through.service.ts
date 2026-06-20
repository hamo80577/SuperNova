import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UserRole } from "@prisma/client";

import { canonicalPerformanceMonth } from "./dashboard-cache-key";
import { DashboardCacheStoreService } from "./dashboard-cache-store.service";
import type { DashboardPerformanceQuery } from "./dashboard-cache.types";

interface DashboardCacheReadThroughInput<T> {
  role: UserRole;
  userId: string;
  query: DashboardPerformanceQuery;
  calculate: () => Promise<T>;
  now?: Date;
}

@Injectable()
export class DashboardCacheReadThroughService {
  private readonly logger = new Logger(DashboardCacheReadThroughService.name);

  constructor(
    @Inject(DashboardCacheStoreService)
    private readonly store: DashboardCacheStoreService
  ) {}

  async getOrCalculate<T>(input: DashboardCacheReadThroughInput<T>) {
    const month = canonicalPerformanceMonth(input.query, input.now);
    if (!month) {
      return input.calculate();
    }

    try {
      const cached = await this.store.get<T>(input.role, input.userId, month);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        `Dashboard cache read-through failed: ${errorMessage(error)}`
      );
    }

    const calculated = await input.calculate();

    try {
      await this.store.writeMany([
        {
          role: input.role,
          userId: input.userId,
          month,
          summary: calculated
        }
      ]);
    } catch (error) {
      this.logger.warn(
        `Dashboard cache population failed: ${errorMessage(error)}`
      );
    }

    return calculated;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown cache error.";
}
