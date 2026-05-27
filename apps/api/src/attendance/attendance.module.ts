import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceImportService } from "./attendance-import.service";
import { AttendanceImportsController } from "./attendance-imports.controller";
import { AttendanceReportService } from "./attendance-report.service";
import { AttendanceReportsController } from "./attendance-reports.controller";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceUserLookupService } from "./attendance-user-lookup.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [AttendanceImportsController, AttendanceReportsController],
  providers: [
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceReportService,
    AttendanceParserService,
    AttendanceUserLookupService,
    AttendanceValidatorService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceReportService,
    AttendanceParserService,
    AttendanceUserLookupService,
    AttendanceValidatorService
  ]
})
export class AttendanceModule {}
