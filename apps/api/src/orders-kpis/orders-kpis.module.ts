import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { ImportJobsModule } from "../import-jobs/import-jobs.module";
import { OrdersKpisImportQueueService } from "./orders-kpis-import-queue.service";
import { OrdersKpisImportService } from "./orders-kpis-import.service";
import { OrdersKpisImportsController } from "./orders-kpis-imports.controller";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import { OrdersKpisReportService } from "./orders-kpis-report.service";
import { OrdersKpisReportsController } from "./orders-kpis-reports.controller";
import { OrdersKpisTargetSettingsController } from "./orders-kpis-target-settings.controller";
import { OrdersKpisTargetSettingsService } from "./orders-kpis-target-settings.service";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

@Module({
  imports: [AuditModule, ImportJobsModule, JwtModule.register({}), UsersModule],
  controllers: [
    OrdersKpisImportsController,
    OrdersKpisReportsController,
    OrdersKpisTargetSettingsController
  ],
  providers: [
    OrdersKpisImportService,
    OrdersKpisImportQueueService,
    OrdersKpisParserService,
    OrdersKpisReportService,
    OrdersKpisTargetSettingsService,
    OrdersKpisValidatorService
  ],
  exports: [
    OrdersKpisImportService,
    OrdersKpisImportQueueService,
    OrdersKpisParserService,
    OrdersKpisReportService,
    OrdersKpisTargetSettingsService,
    OrdersKpisValidatorService
  ]
})
export class OrdersKpisModule {}
