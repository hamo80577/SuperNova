import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuditModule } from "../audit/audit.module";
import { UsersModule } from "../users/users.module";
import { AttendanceAssignmentSnapshotService } from "./attendance-assignment-snapshot.service";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceImportService } from "./attendance-import.service";
import { AttendanceIssueService } from "./attendance-issue.service";
import { AttendanceHistoricalAssignmentBackfillService } from "./attendance-historical-assignment-backfill.service";
import { AttendanceLocationMapperService } from "./attendance-location-mapper.service";
import { AttendanceMatcherService } from "./attendance-matcher.service";
import { AttendanceOperationsController } from "./attendance-operations.controller";
import { AttendanceOperationsService } from "./attendance-operations.service";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceSummaryService } from "./attendance-summary.service";

@Module({
  imports: [AuditModule, JwtModule.register({}), UsersModule],
  controllers: [AttendanceOperationsController],
  providers: [
    AttendanceAssignmentSnapshotService,
    AttendanceCalculationService,
    AttendanceHistoricalAssignmentBackfillService,
    AttendanceImportService,
    AttendanceIssueService,
    AttendanceLocationMapperService,
    AttendanceMatcherService,
    AttendanceOperationsService,
    AttendanceParserService,
    AttendanceSummaryService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceHistoricalAssignmentBackfillService,
    AttendanceImportService,
    AttendanceLocationMapperService,
    AttendanceMatcherService,
    AttendanceOperationsService,
    AttendanceParserService,
    AttendanceSummaryService
  ]
})
export class AttendanceModule {}
