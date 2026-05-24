import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AttendanceIssueSeverity, AttendanceIssueType } from "@prisma/client";

import type { AttendanceIssueDraft } from "./attendance.types";

@Injectable()
export class AttendanceIssueService {
  build(params: {
    severity: AttendanceIssueSeverity;
    type: AttendanceIssueType;
    message: string;
    rowNumber?: number | null;
    identifier?: string | null;
    attendanceDate?: Date | null;
    metadata?: Prisma.InputJsonValue;
  }): AttendanceIssueDraft {
    return {
      severity: params.severity,
      type: params.type,
      message: params.message,
      rowNumber: params.rowNumber ?? null,
      identifier: params.identifier ?? null,
      attendanceDate: params.attendanceDate ?? null,
      ...(params.metadata ? { metadata: params.metadata } : {})
    };
  }
}

