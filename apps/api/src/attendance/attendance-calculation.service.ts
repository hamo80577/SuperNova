import { Injectable } from "@nestjs/common";
import { AttendanceRecordStatus } from "@prisma/client";

import type {
  AttendanceDailyCalculationInput,
  AttendanceDailyMetrics
} from "./attendance.types";

@Injectable()
export class AttendanceCalculationService {
  calculateDailyMetrics(
    input: AttendanceDailyCalculationInput
  ): AttendanceDailyMetrics {
    const rawStatus = input.status?.trim() ?? "";
    const normalizedStatus = normalizeText(rawStatus);
    const shiftName = input.shiftName ?? "";
    const isWorkedShift =
      normalizedStatus === "on time" || normalizedStatus === "late";
    const isAbsent = normalizedStatus === "absent";
    const isOnLeave = normalizedStatus === "on leave";
    const isOffDay =
      normalizeText(shiftName).includes("off day") ||
      normalizedStatus === "off day";
    const lateMinutes =
      isWorkedShift && input.scheduledStartAt && input.actualCheckInAt
        ? Math.max(
            0,
            Math.floor(
              (input.actualCheckInAt.getTime() -
                input.scheduledStartAt.getTime()) /
                60_000
            )
          )
        : 0;

    return {
      status: toAttendanceRecordStatus(normalizedStatus),
      lateMinutes,
      lateLevel1Over15: lateMinutes > 15,
      lateLevel2From31To45: lateMinutes > 30 && lateMinutes <= 45,
      lateLevel3Over45: lateMinutes > 45,
      isAbsent,
      isOnLeave,
      isAnnualLeave: normalizeText(shiftName).includes("annual leave"),
      isMedicalLeave: normalizeText(shiftName).includes("medical leave"),
      isOffDay,
      isUnder8Hours:
        isWorkedShift &&
        input.actualWorkDurationHours !== null &&
        input.actualWorkDurationHours < 8,
      isOver15Hours:
        isWorkedShift &&
        input.actualWorkDurationHours !== null &&
        input.actualWorkDurationHours > 15,
      isWorkedShift
    };
  }

  calculateTotalShiftsNeeded(input: {
    periodFrom: Date;
    periodTo: Date;
    joiningDate: Date | null;
  }) {
    const periodFrom = startOfUtcDay(input.periodFrom);
    const periodTo = startOfUtcDay(input.periodTo);

    if (periodFrom.getTime() > periodTo.getTime()) {
      return 0;
    }

    if (input.joiningDate && startOfUtcDay(input.joiningDate) > periodTo) {
      return 0;
    }

    const neededFrom =
      input.joiningDate && startOfUtcDay(input.joiningDate) > periodFrom
        ? startOfUtcDay(input.joiningDate)
        : periodFrom;

    return (
      Math.floor((periodTo.getTime() - neededFrom.getTime()) / 86_400_000) + 1
    );
  }
}

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function toAttendanceRecordStatus(status: string) {
  if (status === "on time") return AttendanceRecordStatus.ON_TIME;
  if (status === "late") return AttendanceRecordStatus.LATE;
  if (status === "absent") return AttendanceRecordStatus.ABSENT;
  if (status === "on leave") return AttendanceRecordStatus.ON_LEAVE;
  return AttendanceRecordStatus.UNKNOWN;
}

