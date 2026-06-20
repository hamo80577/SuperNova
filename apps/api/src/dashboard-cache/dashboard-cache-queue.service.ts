import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
  DASHBOARD_CACHE_BULK_JOB,
  DASHBOARD_CACHE_JOB_OPTIONS,
  DASHBOARD_CACHE_QUEUE,
  DASHBOARD_CACHE_TARGETED_JOB
} from "./dashboard-cache.constants";
import type {
  DashboardCacheBulkEvent,
  DashboardCacheJobData,
  DashboardCacheTargetedEvent
} from "./dashboard-cache.types";

@Injectable()
export class DashboardCacheQueueService {
  constructor(
    @InjectQueue(DASHBOARD_CACHE_QUEUE)
    private readonly queue: Queue<DashboardCacheJobData>
  ) {}

  enqueueBulk(event: DashboardCacheBulkEvent) {
    const jobData = { ...event, kind: "BULK" as const };
    return this.queue.add(DASHBOARD_CACHE_BULK_JOB, jobData, {
      ...DASHBOARD_CACHE_JOB_OPTIONS,
      jobId: deterministicJobId("bulk", event.source, event.eventId)
    });
  }

  enqueueTargeted(event: DashboardCacheTargetedEvent) {
    const jobData = { ...event, kind: "TARGETED" as const };
    return this.queue.add(DASHBOARD_CACHE_TARGETED_JOB, jobData, {
      ...DASHBOARD_CACHE_JOB_OPTIONS,
      jobId: deterministicJobId("targeted", event.source, event.eventId)
    });
  }
}

function deterministicJobId(kind: string, source: string, eventId: string) {
  return [kind, source, eventId]
    .map((part) =>
      part
        .toLowerCase()
        .replaceAll("_", "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter(Boolean)
    .join("-");
}
