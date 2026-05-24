import { Module } from "@nestjs/common";

import { AttendanceAssignmentSnapshotService } from "./attendance-assignment-snapshot.service";
import { AttendanceCalculationService } from "./attendance-calculation.service";
import { AttendanceImportService } from "./attendance-import.service";
import { AttendanceIssueService } from "./attendance-issue.service";
import { AttendanceMatcherService } from "./attendance-matcher.service";
import { AttendanceParserService } from "./attendance-parser.service";
import { AttendanceSummaryService } from "./attendance-summary.service";

@Module({
  providers: [
    AttendanceAssignmentSnapshotService,
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceIssueService,
    AttendanceMatcherService,
    AttendanceParserService,
    AttendanceSummaryService
  ],
  exports: [
    AttendanceCalculationService,
    AttendanceImportService,
    AttendanceMatcherService,
    AttendanceParserService,
    AttendanceSummaryService
  ]
})
export class AttendanceModule {}

