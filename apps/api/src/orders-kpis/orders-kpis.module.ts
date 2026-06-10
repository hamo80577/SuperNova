import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { OrdersKpisImportService } from "./orders-kpis-import.service";
import { OrdersKpisImportsController } from "./orders-kpis-imports.controller";
import { OrdersKpisParserService } from "./orders-kpis-parser.service";
import { OrdersKpisValidatorService } from "./orders-kpis-validator.service";

@Module({
  imports: [AuditModule, JwtModule.register({}), UsersModule],
  controllers: [OrdersKpisImportsController],
  providers: [
    OrdersKpisImportService,
    OrdersKpisParserService,
    OrdersKpisValidatorService
  ],
  exports: [
    OrdersKpisImportService,
    OrdersKpisParserService,
    OrdersKpisValidatorService
  ]
})
export class OrdersKpisModule {}
