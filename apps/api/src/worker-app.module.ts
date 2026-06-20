import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { AttendanceModule } from "./attendance/attendance.module";
import { DashboardCacheWorkerModule } from "./dashboard-cache/dashboard-cache-worker.module";
import configuration from "./config/configuration";
import { validateEnvironment } from "./config/env.validation";
import { ExcelImportProcessor } from "./import-jobs/excel-import.processor";
import { ImportJobsModule } from "./import-jobs/import-jobs.module";
import { OrdersKpisModule } from "./orders-kpis/orders-kpis.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnvironment
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    ImportJobsModule,
    DashboardCacheWorkerModule,
    AttendanceModule,
    OrdersKpisModule
  ],
  providers: [ExcelImportProcessor]
})
export class WorkerAppModule {}
