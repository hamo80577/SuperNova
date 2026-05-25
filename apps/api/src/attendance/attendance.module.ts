import { Module } from "@nestjs/common";

import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

@Module({
  providers: [
    AttendanceCalculationService,
    AttendanceParserService,
    AttendanceValidatorService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceParserService,
    AttendanceValidatorService
  ]
})
export class AttendanceModule {}
