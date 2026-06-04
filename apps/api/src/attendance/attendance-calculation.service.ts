import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  AttendanceCalculatedStatus,
  AttendanceIssueCode,
  AttendanceIssueResolutionStatus,
  AttendanceIssueSeverity,
  AttendanceLateBucket,
  AttendanceLeaveType,
  AttendanceMatchStatus
} from "@prisma/client";

import type {
  AttendanceCalculationInput,
  AttendanceCalculationInputRow,
  AttendanceCalculationIssue,
  AttendanceCalculationResult,
  AttendanceDailyCalculationRecord,
  AttendancePickerMonthlyCalculationSummary
} from "./attendance-calculation.types";

const graceMins = 15;

interface RowCalculationState {
  calculatedStatus: AttendanceCalculatedStatus;
  rawLateMins: number | null;
  chargeableLateMins: number | null;
  lateBucket: AttendanceLateBucket | null;
  issues: AttendanceCalculationIssue[];
}

@Injectable()
export class AttendanceCalculationService {
  calculate(input: AttendanceCalculationInput): AttendanceCalculationResult {
    const calculatedAt = normalizeCalculatedAt(input.calculatedAt);
    const issues: AttendanceCalculationIssue[] = [];
    const dailyRecords: AttendanceDailyCalculationRecord[] = [];

    for (const row of input.rows) {
      if (!isEligibleMatchedPickerRow(row)) {
        continue;
      }

      const { record, rowIssues } = calculateDailyRecord(input.periodMonth, row);
      dailyRecords.push(record);
      issues.push(...rowIssues);
    }

    return {
      dailyRecords,
      monthlySummaries: buildMonthlySummaries(dailyRecords, calculatedAt),
      issues
    };
  }
}

function calculateDailyRecord(
  fallbackPeriodMonth: string,
  row: AttendanceCalculationInputRow
) {
  const periodMonth = row.periodMonth || fallbackPeriodMonth;
  const state = calculateRowState(row);
  const isOnTime = state.calculatedStatus === AttendanceCalculatedStatus.ON_TIME;
  const isLate = state.calculatedStatus === AttendanceCalculatedStatus.LATE;
  const isAbsent = state.calculatedStatus === AttendanceCalculatedStatus.ABSENT;
  const isOffDay = state.calculatedStatus === AttendanceCalculatedStatus.OFF_DAY;
  const leaveType = leaveTypeForStatus(state.calculatedStatus);
  const isOnLeave = leaveType !== null;
  const isWorkingDay = isOnTime || isLate;
  const actualWorkDurationHours = row.actualWorkDurationHours;
  const isUnder8Hours =
    isWorkingDay &&
    typeof actualWorkDurationHours === "number" &&
    actualWorkDurationHours < 8;
  const isOver15Hours =
    isWorkingDay &&
    typeof actualWorkDurationHours === "number" &&
    actualWorkDurationHours > 15;

  const record: AttendanceDailyCalculationRecord = {
    periodMonth,
    shiftDate: row.shiftDate,
    shopperId: row.shopperId,
    userId: row.userId,
    pickerNameSnapshot: row.pickerNameSnapshot,
    sourceName: cleanText(row.sourceName),
    sourceDesignation: cleanText(row.sourceDesignation),
    division: row.division,
    sourceSubDivision: cleanText(row.sourceSubDivision),
    sourceLocation: cleanText(row.sourceLocation),
    sourceLocationCode: cleanText(row.sourceLocationCode),
    reportedVendorId: cleanText(row.reportedVendorId),
    reportedChainId: cleanText(row.reportedChainId),
    reportedLocationCode: cleanText(row.reportedLocationCode),
    reportedLocationName: cleanText(row.reportedLocationName),
    reportedLocationRaw: cleanText(row.reportedLocationRaw),
    shiftLocationCode: cleanText(row.shiftLocationCode),
    shiftLocationName: cleanText(row.shiftLocationName),
    shiftLocationRaw: cleanText(row.shiftLocationRaw),
    locationMappingStatus: row.locationMappingStatus,
    assignmentMismatchStatus: row.assignmentMismatchStatus,
    shiftName: cleanText(row.shiftName) ?? "",
    scheduledStartTime: cleanText(row.scheduledStartTime),
    scheduledEndTime: cleanText(row.scheduledEndTime),
    scheduledStartAt: combineDateTime(row.shiftDate, row.scheduledStartTime),
    scheduledEndAt: combineDateTime(row.shiftDate, row.scheduledEndTime),
    scheduledShiftHours: row.scheduledShiftHours,
    breakDurationMins: row.breakDurationMins,
    actualCheckinTime: cleanText(row.actualCheckinTime),
    actualCheckoutTime: cleanText(row.actualCheckoutTime),
    actualWorkDurationHours,
    sourceStatus: cleanText(row.sourceStatus),
    calculatedStatus: state.calculatedStatus,
    rawLateMins: state.rawLateMins,
    graceMins: isWorkingDay ? graceMins : null,
    chargeableLateMins: state.chargeableLateMins,
    lateBucket: state.lateBucket,
    isLate,
    isOnTime,
    isAbsent,
    isOffDay,
    isOnLeave,
    leaveType,
    isAnnualLeave: leaveType === AttendanceLeaveType.ANNUAL_LEAVE,
    isMedicalLeave: leaveType === AttendanceLeaveType.MEDICAL_LEAVE,
    isWorkingDay,
    isUnder8Hours,
    isOver15Hours,
    matchStatus: AttendanceMatchStatus.MATCHED_PICKER,
    rawRowNumber: row.rawRowNumber,
    rowHash: hashNormalizedRow(periodMonth, row),
    issuesCount: (row.issuesCount ?? 0) + state.issues.length
  };

  return { record, rowIssues: state.issues };
}

function calculateRowState(row: AttendanceCalculationInputRow): RowCalculationState {
  const shiftName = cleanText(row.shiftName)?.toUpperCase() ?? "";
  const sourceStatus = cleanText(row.sourceStatus)?.toUpperCase() ?? "";

  if (shiftName.includes("OFF DAY")) {
    return nonWorkingState(AttendanceCalculatedStatus.OFF_DAY);
  }

  if (shiftName.includes("ANNUAL LEAVE")) {
    return nonWorkingState(AttendanceCalculatedStatus.ANNUAL_LEAVE);
  }

  if (shiftName.includes("MEDICAL LEAVE")) {
    return nonWorkingState(AttendanceCalculatedStatus.MEDICAL_LEAVE);
  }

  if (sourceStatus === "ON LEAVE") {
    return nonWorkingState(AttendanceCalculatedStatus.OTHER_LEAVE);
  }

  if (sourceStatus === "ABSENT") {
    return nonWorkingState(AttendanceCalculatedStatus.ABSENT);
  }

  const scheduledStartMins = parseTimeToMinutes(row.scheduledStartTime);
  const actualCheckinMins = parseTimeToMinutes(row.actualCheckinTime);

  if (scheduledStartMins !== null && actualCheckinMins !== null) {
    const rawLateMins = Math.max(0, actualCheckinMins - scheduledStartMins);
    const chargeableLateMins = Math.max(0, rawLateMins - graceMins);

    return {
      calculatedStatus:
        rawLateMins <= graceMins
          ? AttendanceCalculatedStatus.ON_TIME
          : AttendanceCalculatedStatus.LATE,
      rawLateMins,
      chargeableLateMins,
      lateBucket: lateBucketForRawLateMins(rawLateMins),
      issues: []
    };
  }

  return {
    calculatedStatus: AttendanceCalculatedStatus.INVALID_OR_MISSING_ATTENDANCE_DATA,
    rawLateMins: null,
    chargeableLateMins: null,
    lateBucket: null,
    issues: [missingOrInvalidTimeIssue(row)]
  };
}

function nonWorkingState(
  calculatedStatus: AttendanceCalculatedStatus
): RowCalculationState {
  return {
    calculatedStatus,
    rawLateMins: null,
    chargeableLateMins: null,
    lateBucket: null,
    issues: []
  };
}

function lateBucketForRawLateMins(rawLateMins: number) {
  if (rawLateMins <= graceMins) {
    return AttendanceLateBucket.NONE;
  }

  if (rawLateMins <= 30) {
    return AttendanceLateBucket.LATE_1;
  }

  if (rawLateMins <= 45) {
    return AttendanceLateBucket.LATE_2;
  }

  return AttendanceLateBucket.LATE_3;
}

function leaveTypeForStatus(status: AttendanceCalculatedStatus) {
  if (status === AttendanceCalculatedStatus.ANNUAL_LEAVE) {
    return AttendanceLeaveType.ANNUAL_LEAVE;
  }

  if (status === AttendanceCalculatedStatus.MEDICAL_LEAVE) {
    return AttendanceLeaveType.MEDICAL_LEAVE;
  }

  if (status === AttendanceCalculatedStatus.OTHER_LEAVE) {
    return AttendanceLeaveType.OTHER_LEAVE;
  }

  return null;
}

function buildMonthlySummaries(
  records: AttendanceDailyCalculationRecord[],
  calculatedAt: string
) {
  const summaries = new Map<string, AttendancePickerMonthlyCalculationSummary>();

  for (const record of records) {
    const key = `${record.periodMonth}:${record.userId}`;
    let summary = summaries.get(key);

    if (!summary) {
      summary = emptySummary(record, calculatedAt);
      summaries.set(key, summary);
    }

    applyRecordToSummary(summary, record);
  }

  return Array.from(summaries.values()).sort((a, b) => {
    const periodCompare = a.periodMonth.localeCompare(b.periodMonth);
    return periodCompare || a.userId.localeCompare(b.userId);
  });
}

function emptySummary(
  record: AttendanceDailyCalculationRecord,
  calculatedAt: string
): AttendancePickerMonthlyCalculationSummary {
  return {
    periodMonth: record.periodMonth,
    shopperId: record.shopperId,
    userId: record.userId,
    pickerNameSnapshot: record.pickerNameSnapshot,
    totalScheduledRows: 0,
    totalWorkingDays: 0,
    onTimeDays: 0,
    lateDays: 0,
    totalRawLateMins: 0,
    totalChargeableLateMins: 0,
    late1Count: 0,
    late2Count: 0,
    late3Count: 0,
    absentCount: 0,
    leaveCount: 0,
    annualLeaveCount: 0,
    medicalLeaveCount: 0,
    otherLeaveCount: 0,
    offDayCount: 0,
    under8HoursCount: 0,
    over15HoursCount: 0,
    firstShiftDate: null,
    lastShiftDate: null,
    lastCalculatedAt: calculatedAt
  };
}

function applyRecordToSummary(
  summary: AttendancePickerMonthlyCalculationSummary,
  record: AttendanceDailyCalculationRecord
) {
  summary.totalScheduledRows += 1;
  summary.totalRawLateMins += record.rawLateMins ?? 0;
  summary.totalChargeableLateMins += record.chargeableLateMins ?? 0;

  if (record.calculatedStatus === AttendanceCalculatedStatus.ON_TIME) {
    summary.onTimeDays += 1;
    summary.totalWorkingDays += 1;
  }

  if (record.calculatedStatus === AttendanceCalculatedStatus.LATE) {
    summary.lateDays += 1;
    summary.totalWorkingDays += 1;
  }

  if (record.lateBucket === AttendanceLateBucket.LATE_1) {
    summary.late1Count += 1;
  }

  if (record.lateBucket === AttendanceLateBucket.LATE_2) {
    summary.late2Count += 1;
  }

  if (record.lateBucket === AttendanceLateBucket.LATE_3) {
    summary.late3Count += 1;
  }

  if (record.isAbsent) {
    summary.absentCount += 1;
  }

  if (record.isOnLeave) {
    summary.leaveCount += 1;
  }

  if (record.isAnnualLeave) {
    summary.annualLeaveCount += 1;
  }

  if (record.isMedicalLeave) {
    summary.medicalLeaveCount += 1;
  }

  if (record.leaveType === AttendanceLeaveType.OTHER_LEAVE) {
    summary.otherLeaveCount += 1;
  }

  if (record.isOffDay) {
    summary.offDayCount += 1;
  }

  if (record.isUnder8Hours) {
    summary.under8HoursCount += 1;
  }

  if (record.isOver15Hours) {
    summary.over15HoursCount += 1;
  }

  if (!summary.firstShiftDate || record.shiftDate < summary.firstShiftDate) {
    summary.firstShiftDate = record.shiftDate;
  }

  if (!summary.lastShiftDate || record.shiftDate > summary.lastShiftDate) {
    summary.lastShiftDate = record.shiftDate;
  }
}

function missingOrInvalidTimeIssue(
  row: AttendanceCalculationInputRow
): AttendanceCalculationIssue {
  const scheduledStartMins = parseTimeToMinutes(row.scheduledStartTime);
  const actualCheckinMins = parseTimeToMinutes(row.actualCheckinTime);

  if (!cleanText(row.actualCheckinTime)) {
    return rowIssue(
      row,
      AttendanceIssueCode.MISSING_CHECKIN,
      "Actual Checkin Time",
      "Actual Checkin Time is required for regular attendance rows."
    );
  }

  if (actualCheckinMins === null) {
    return rowIssue(
      row,
      AttendanceIssueCode.INVALID_TIME,
      "Actual Checkin Time",
      "Actual Checkin Time must be a valid time."
    );
  }

  if (scheduledStartMins === null) {
    return rowIssue(
      row,
      AttendanceIssueCode.INVALID_TIME,
      "Shift Scheduled Start Time",
      "Shift Scheduled Start Time must be a valid time."
    );
  }

  return rowIssue(
    row,
    AttendanceIssueCode.INVALID_TIME,
    "Actual Checkin Time",
    "Attendance row is missing required time values."
  );
}

function rowIssue(
  row: AttendanceCalculationInputRow,
  issueCode: AttendanceIssueCode,
  fieldName: string,
  message: string
): AttendanceCalculationIssue {
  return {
    rowNumber: row.rawRowNumber,
    shopperId: row.shopperId,
    severity: AttendanceIssueSeverity.ERROR,
    issueCode,
    fieldName,
    message,
    resolutionStatus: AttendanceIssueResolutionStatus.OPEN
  };
}

function isEligibleMatchedPickerRow(row: AttendanceCalculationInputRow) {
  const matchStatus = row.matchStatus ?? AttendanceMatchStatus.MATCHED_PICKER;

  return matchStatus === AttendanceMatchStatus.MATCHED_PICKER && isEgypt(row.division);
}

function isEgypt(division: string) {
  return division.trim().toUpperCase() === "EGYPT";
}

function parseTimeToMinutes(value: string | null | undefined) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function combineDateTime(shiftDate: string, time: string | null | undefined) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    return null;
  }

  const minutes = parseTimeToMinutes(time);

  if (minutes === null) {
    return null;
  }

  return `${shiftDate}T${pad(Math.floor(minutes / 60))}:${pad(
    minutes % 60
  )}:00.000Z`;
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeCalculatedAt(calculatedAt: Date | string | undefined) {
  if (calculatedAt instanceof Date) {
    return calculatedAt.toISOString();
  }

  return calculatedAt ?? new Date().toISOString();
}

function hashNormalizedRow(
  periodMonth: string,
  row: AttendanceCalculationInputRow
) {
  return createHash("sha256")
    .update(stableStringify({
      periodMonth,
      shiftDate: row.shiftDate,
      shopperId: row.shopperId,
      userId: row.userId,
      pickerNameSnapshot: row.pickerNameSnapshot,
      sourceName: cleanText(row.sourceName),
      sourceDesignation: cleanText(row.sourceDesignation),
      division: cleanText(row.division),
      sourceSubDivision: cleanText(row.sourceSubDivision),
      sourceLocation: cleanText(row.sourceLocation),
      sourceLocationCode: cleanText(row.sourceLocationCode),
      reportedVendorId: cleanText(row.reportedVendorId),
      reportedChainId: cleanText(row.reportedChainId),
      reportedLocationCode: cleanText(row.reportedLocationCode),
      reportedLocationName: cleanText(row.reportedLocationName),
      reportedLocationRaw: cleanText(row.reportedLocationRaw),
      shiftLocationCode: cleanText(row.shiftLocationCode),
      shiftLocationName: cleanText(row.shiftLocationName),
      shiftLocationRaw: cleanText(row.shiftLocationRaw),
      locationMappingStatus: row.locationMappingStatus,
      assignmentMismatchStatus: row.assignmentMismatchStatus,
      shiftName: cleanText(row.shiftName),
      scheduledStartTime: cleanText(row.scheduledStartTime),
      scheduledEndTime: cleanText(row.scheduledEndTime),
      scheduledShiftHours: row.scheduledShiftHours,
      breakDurationMins: row.breakDurationMins,
      actualCheckinTime: cleanText(row.actualCheckinTime),
      actualCheckoutTime: cleanText(row.actualCheckoutTime),
      actualWorkDurationHours: row.actualWorkDurationHours,
      sourceStatus: cleanText(row.sourceStatus),
      matchStatus: row.matchStatus ?? AttendanceMatchStatus.MATCHED_PICKER,
      rawRowNumber: row.rawRowNumber
    }))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const entries = Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
