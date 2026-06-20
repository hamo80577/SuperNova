import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";

import {
  DASHBOARD_CACHE_BULK_JOB,
  DASHBOARD_CACHE_QUEUE,
  DASHBOARD_CACHE_TARGETED_JOB
} from "./dashboard-cache.constants";
import type { DashboardCacheJobData } from "./dashboard-cache.types";
import { DashboardCacheWarmerService } from "./dashboard-cache-warmer.service";

@Processor(DASHBOARD_CACHE_QUEUE, { concurrency: 2 })
export class DashboardCacheProcessor extends WorkerHost {
  constructor(
    @Inject(DashboardCacheWarmerService)
    private readonly warmer: DashboardCacheWarmerService
  ) {
    super();
  }

  process(job: Job<DashboardCacheJobData>) {
    if (
      job.name === DASHBOARD_CACHE_TARGETED_JOB &&
      job.data.kind === "TARGETED"
    ) {
      return this.warmer.warmTargeted(job.data);
    }

    if (job.name === DASHBOARD_CACHE_BULK_JOB && job.data.kind === "BULK") {
      return this.warmer.warmBulk(job.data);
    }

    throw new Error(`Unsupported dashboard cache job ${job.name}.`);
  }
}
