import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { OrdersKpisImportService } from "./orders-kpis-import.service";
import { OrdersKpisImportsController } from "./orders-kpis-imports.controller";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import { OrdersKpisReportService } from "./orders-kpis-report.service";
import { OrdersKpisReportsController } from "./orders-kpis-reports.controller";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [OrdersKpisImportsController, OrdersKpisReportsController],
  providers: [
    OrdersKpisImportService,
    OrdersKpisParserService,
    OrdersKpisReportService,
    OrdersKpisValidatorService
  ],
  exports: [
    OrdersKpisImportService,
    OrdersKpisParserService,
    OrdersKpisReportService,
    OrdersKpisValidatorService
  ]
})
export class OrdersKpisModule {}
