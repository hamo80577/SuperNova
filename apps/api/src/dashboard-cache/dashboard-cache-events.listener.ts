import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AccountStatus, EmploymentStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  DASHBOARD_CACHEABLE_ROLES,
  IMPORT_ATTENDANCE_SUCCESS_EVENT,
  IMPORT_KPI_SUCCESS_EVENT,
  USER_METRICS_UPDATED_EVENT
} from "./dashboard-cache.constants";
import { canonicalMonthRange } from "./dashboard-cache-key";
import { DashboardCacheQueueService } from "./dashboard-cache-queue.service";
import { DashboardCacheStoreService } from "./dashboard-cache-store.service";
import type {
  DashboardCacheBulkEvent,
  DashboardCacheTargetedEvent
} from "./dashboard-cache.types";

@Injectable()
export class DashboardCacheEventsListener {
  private readonly logger = new Logger(DashboardCacheEventsListener.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DashboardCacheStoreService)
    private readonly store: DashboardCacheStoreService,
    @Inject(DashboardCacheQueueService)
    private readonly queue: DashboardCacheQueueService
  ) {}

  @OnEvent(USER_METRICS_UPDATED_EVENT, { async: true, suppressErrors: true })
  async onUserMetricsUpdated(event: DashboardCacheTargetedEvent) {
    if (!canonicalMonthRange(event.month)) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: event.userId },
      select: {
        id: true,
        role: true,
        accountStatus: true,
        employmentStatus: true
      }
    });

    if (
      !user ||
      user.accountStatus !== AccountStatus.ACTIVE ||
      user.employmentStatus !== EmploymentStatus.ACTIVE ||
      !isCacheableRole(user.role)
    ) {
      return;
    }

    await this.store.delete(user.role, user.id, event.month);
    await this.queue.enqueueTargeted(event);
  }

  @OnEvent(IMPORT_ATTENDANCE_SUCCESS_EVENT, {
    async: true,
    suppressErrors: true
  })
  async onAttendanceImportSuccess(event: DashboardCacheBulkEvent) {
    await this.enqueueBulk(event);
  }

  @OnEvent(IMPORT_KPI_SUCCESS_EVENT, { async: true, suppressErrors: true })
  async onKpiImportSuccess(event: DashboardCacheBulkEvent) {
    await this.enqueueBulk(event);
  }

  private async enqueueBulk(event: DashboardCacheBulkEvent) {
    const months = Array.from(new Set(event.months)).filter((month) =>
      Boolean(canonicalMonthRange(month))
    );
    if (months.length === 0) {
      return;
    }

    try {
      await this.queue.enqueueBulk({ ...event, months });
    } catch (error) {
      this.logger.error(
        `Dashboard cache bulk queue dispatch failed: ${errorMessage(error)}`
      );
    }
  }
}

function isCacheableRole(role: UserRole) {
  return (DASHBOARD_CACHEABLE_ROLES as readonly UserRole[]).includes(role);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown queue error.";
}
