import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AttendanceModule } from "./attendance/attendance.module";
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
    PrismaModule,
    ImportJobsModule,
    AttendanceModule,
    OrdersKpisModule
  ],
  providers: [ExcelImportProcessor]
})
export class WorkerAppModule {}
