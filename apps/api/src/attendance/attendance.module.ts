import { Module } from "@nestjs/common";

import { AttendanceAssignmentSnapshotService } from "./attendance-assignment-snapshot.service";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceImportService } from "./attendance-import.service";
import { AttendanceIssueService } from "./attendance-issue.service";
import { AttendanceHistoricalAssignmentBackfillService } from "./attendance-historical-assignment-backfill.service";
import { AttendanceLocationMapperService } from "./attendance-location-mapper.service";
import { AttendanceMatcherService } from "./attendance-matcher.service";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceSummaryService } from "./attendance-summary.service";

@Module({
  providers: [
    AttendanceAssignmentSnapshotService,
    AttendanceCalculationService,
    AttendanceHistoricalAssignmentBackfillService,
    AttendanceImportService,
    AttendanceIssueService,
    AttendanceLocationMapperService,
    AttendanceMatcherService,
    AttendanceParserService,
    AttendanceSummaryService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceHistoricalAssignmentBackfillService,
    AttendanceImportService,
    AttendanceLocationMapperService,
    AttendanceMatcherService,
    AttendanceParserService,
    AttendanceSummaryService
  ]
})
export class AttendanceModule {}
