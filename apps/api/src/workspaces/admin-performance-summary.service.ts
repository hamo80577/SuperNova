import { Inject, Injectable } from "@nestjs/common";

import { OrdersKpisTargetSettingsService } from "../orders-kpis/orders-kpis-target-settings.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminPerformanceSummaryQueryDto } from "./dto/admin-performance-summary-query.dto";

@Injectable()
export class AdminPerformanceSummaryService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(OrdersKpisTargetSettingsService)
    private readonly targetSettingsService: OrdersKpisTargetSettingsService
  ) {}

  getSummary(_query: AdminPerformanceSummaryQueryDto): Promise<never> {
    void this.prisma;
    void this.targetSettingsService;
    throw new Error("Admin performance summary is not implemented.");
  }
}
