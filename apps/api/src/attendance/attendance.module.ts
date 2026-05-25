import { Module } from "@nestjs/common";

import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceValidatorService } from "./attendance-validator.service";

@Module({
  providers: [AttendanceParserService, AttendanceValidatorService],
  exports: [AttendanceParserService, AttendanceValidatorService]
})
export class AttendanceModule {}
