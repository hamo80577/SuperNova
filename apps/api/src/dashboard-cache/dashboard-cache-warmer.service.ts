import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccountStatus,
  EmploymentStatus,
  UserRole
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AreaManagerPerformanceSummaryService } from "../workspaces/area-manager-performance-summary.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import {
  DASHBOARD_CACHEABLE_ROLES,
  DASHBOARD_CACHE_DEFAULT_BULK_CHUNK_SIZE,
  DASHBOARD_CACHE_DEFAULT_CALCULATION_CONCURRENCY
} from "./dashboard-cache.constants";
import { canonicalMonthRange } from "./dashboard-cache-key";
import { DashboardCacheStoreService } from "./dashboard-cache-store.service";
import type {
  DashboardCacheBulkJobData,
  DashboardCacheTargetedJobData,
  DashboardCacheWriteEntry
} from "./dashboard-cache.types";

type CacheableUser = {
  id: string;
  role: UserRole;
};

type WarmingResult = {
  warmed: number;
  failed: number;
  skipped: number;
};

@Injectable()
export class DashboardCacheWarmerService {
  private readonly logger = new Logger(DashboardCacheWarmerService.name);
  private readonly chunkSize: number;
  private readonly calculationConcurrency: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DashboardCacheStoreService)
    private readonly store: DashboardCacheStoreService,
    @Inject(WorkspacesService)
    private readonly workspacesService: WorkspacesService,
    @Inject(AreaManagerPerformanceSummaryService)
    private readonly areaManagerService: AreaManagerPerformanceSummaryService,
    @Inject(ConfigService) configService: ConfigService
  ) {
    this.chunkSize =
      configService.get<number>("dashboardCache.bulkChunkSize") ??
      DASHBOARD_CACHE_DEFAULT_BULK_CHUNK_SIZE;
    this.calculationConcurrency =
      configService.get<number>("dashboardCache.calculationConcurrency") ??
      DASHBOARD_CACHE_DEFAULT_CALCULATION_CONCURRENCY;
  }

  async warmTargeted(
    job: DashboardCacheTargetedJobData,
    now: Date = new Date()
  ): Promise<WarmingResult> {
    const range = canonicalMonthRange(job.month, now);
    if (!range) {
      return { warmed: 0, failed: 0, skipped: 1 };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: job.userId },
      select: {
        id: true,
        role: true,
        accountStatus: true,
        employmentStatus: true
      }
    });

    if (!isEligibleUser(user)) {
      return { warmed: 0, failed: 0, skipped: 1 };
    }

    const entry = await this.calculateEntry(user, job.month, range);
    await this.writeEntries([entry]);
    return { warmed: 1, failed: 0, skipped: 0 };
  }

  async warmBulk(
    job: DashboardCacheBulkJobData,
    now: Date = new Date()
  ): Promise<WarmingResult> {
    const months = Array.from(new Set(job.months))
      .map((month) => ({ month, range: canonicalMonthRange(month, now) }))
      .filter(
        (monthEntry): monthEntry is {
          month: string;
          range: { dateFrom: string; dateTo: string };
        } => monthEntry.range !== null
      );

    if (months.length === 0) {
      return { warmed: 0, failed: 0, skipped: 0 };
    }

    const warmingSummary: WarmingResult = { warmed: 0, failed: 0, skipped: 0 };
    let cursor: string | undefined;

    while (true) {
      const users = await this.prisma.user.findMany({
        where: {
          role: { in: [...DASHBOARD_CACHEABLE_ROLES] },
          accountStatus: AccountStatus.ACTIVE,
          employmentStatus: EmploymentStatus.ACTIVE
        },
        select: { id: true, role: true },
        orderBy: { id: "asc" },
        take: this.chunkSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
      });

      if (users.length === 0) {
        break;
      }

      for (const { month, range } of months) {
        const outcomes = await mapWithConcurrency(
          users,
          this.calculationConcurrency,
          async (user) => {
            try {
              return {
                entry: await this.calculateEntry(user, month, range),
                failed: false
              };
            } catch (error) {
              this.logger.error(
                `Dashboard cache calculation failed for ${user.id}/${month}: ${errorMessage(error)}`
              );
              return { entry: null, failed: true };
            }
          }
        );
        const entries = outcomes
          .map((outcome) => outcome.entry)
          .filter((entry): entry is DashboardCacheWriteEntry => entry !== null);
        warmingSummary.failed += outcomes.filter((outcome) => outcome.failed).length;
        warmingSummary.warmed += entries.length;
        await this.writeEntries(entries);
      }

      cursor = users.at(-1)?.id;
      if (users.length < this.chunkSize) {
        break;
      }
    }

    return warmingSummary;
  }

  private async calculateEntry(
    user: CacheableUser,
    month: string,
    range: { dateFrom: string; dateTo: string }
  ): Promise<DashboardCacheWriteEntry> {
    let summary: unknown;

    if (user.role === UserRole.PICKER) {
      summary = await this.workspacesService.calculatePickerPerformanceSummary(
        user.id,
        { ...range, period: "THIS_MONTH" }
      );
    } else if (user.role === UserRole.CHAMP) {
      summary = await this.workspacesService.calculateChampPerformanceSummary(
        user.id,
        range
      );
    } else if (user.role === UserRole.AREA_MANAGER) {
      summary = await this.areaManagerService.calculateSummary(user.id, range);
    } else {
      throw new Error(`Unsupported dashboard cache role ${user.role}.`);
    }

    return { role: user.role, userId: user.id, month, summary };
  }

  private async writeEntries(entries: DashboardCacheWriteEntry[]) {
    if (!(await this.store.writeMany(entries))) {
      throw new Error("Dashboard cache write failed.");
    }
  }
}

function isEligibleUser(
  user:
    | (CacheableUser & {
        accountStatus: AccountStatus;
        employmentStatus: EmploymentStatus;
      })
    | null
): user is CacheableUser & {
  accountStatus: AccountStatus;
  employmentStatus: EmploymentStatus;
} {
  return Boolean(
    user &&
      user.accountStatus === AccountStatus.ACTIVE &&
      user.employmentStatus === EmploymentStatus.ACTIVE &&
      (DASHBOARD_CACHEABLE_ROLES as readonly UserRole[]).includes(user.role)
  );
}

async function mapWithConcurrency<T, R>(
  inputs: T[],
  concurrency: number,
  callback: (input: T) => Promise<R>
) {
  const outputs = new Array<R>(inputs.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), inputs.length) },
    async () => {
      while (nextIndex < inputs.length) {
        const index = nextIndex;
        nextIndex += 1;
        outputs[index] = await callback(inputs[index]);
      }
    }
  );
  await Promise.all(workers);
  return outputs;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown calculation error.";
}
