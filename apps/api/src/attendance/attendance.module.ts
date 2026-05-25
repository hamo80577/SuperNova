import { Module } from "@nestjs/common";

import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceImportService } from "./attendance-import.service";
import { AttendanceImportsController } from "./attendance-imports.controller";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceUserLookupService } from "./attendance-user-lookup.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

@Module({
  controllers: [AttendanceImportsController],
  providers: [
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceParserService,
    AttendanceUserLookupService,
    AttendanceValidatorService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceParserService,
    AttendanceUserLookupService,
    AttendanceValidatorService
  ]
})
export class AttendanceModule {}
