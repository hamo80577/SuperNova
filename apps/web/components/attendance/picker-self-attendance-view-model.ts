import type {
  AttendanceDailyReportRow,
  AttendanceLateBucket
} from "@/lib/api/attendance";

export const PICKER_ATTENDANCE_DEFAULT_TAB = "ERROR" as const;

export type PickerAttendanceTab =
  | "ALL"
  | "CLEAN"
  | "ERROR"
  | "LATE"
  | "ABSENT"
  | "UNDER_8"
  | "OVER_15";

export type PickerShiftScoreState =
  | "clean"
  | "error"
  | "excluded"
  | "unscorable";

export interface PickerShiftTag {
  kind:
    | "absent"
    | "clean"
    | "late_1"
    | "late_2"
    | "late_3"
    | "late_unavailable"
    | "leave"
    | "off_day"
    | "over_15"
    | "under_8";
  label: string;
  tone: "blue" | "emerald" | "rose" | "slate" | "amber";
}

export interface PickerAttendanceRowViewModel {
  id: string;
  row: AttendanceDailyReportRow;
  scoreState: PickerShiftScoreState;
  tags: PickerShiftTag[];
  lateBucket: "LATE_1" | "LATE_2" | "LATE_3" | null;
  lateMinutes: number | null;
  explanation: string;
}

export interface PickerAttendanceViewModel {
  buckets: {
    absent: number;
    late1: number;
    late2: number;
    late3: number;
    over15: number;
    under8: number;
  };
  rows: PickerAttendanceRowViewModel[];
  score: {
    cleanShifts: number;
    errorShifts: number;
    excludedRows: number;
    percentage: number | null;
    scorableShifts: number;
    unavailableLateRows: number;
  };
}

const leaveStatuses = new Set([
  "ANNUAL_LEAVE",
  "MEDICAL_LEAVE",
  "OTHER_LEAVE"
]);

export function buildPickerAttendanceViewModel(
  rows: AttendanceDailyReportRow[]
): PickerAttendanceViewModel {
  const mappedRows = rows.map(toPickerAttendanceRowViewModel);
  const scorableRows = mappedRows.filter(
    (row) => row.scoreState === "clean" || row.scoreState === "error"
  );
  const cleanShifts = mappedRows.filter(
    (row) => row.scoreState === "clean"
  ).length;
  const errorShifts = mappedRows.filter(
    (row) => row.scoreState === "error"
  ).length;
  const scorableShifts = scorableRows.length;

  return {
    buckets: {
      absent: mappedRows.filter((row) => hasTag(row, "absent")).length,
      late1: mappedRows.filter((row) => row.lateBucket === "LATE_1").length,
      late2: mappedRows.filter((row) => row.lateBucket === "LATE_2").length,
      late3: mappedRows.filter((row) => row.lateBucket === "LATE_3").length,
      over15: mappedRows.filter((row) => hasTag(row, "over_15")).length,
      under8: mappedRows.filter((row) => hasTag(row, "under_8")).length
    },
    rows: mappedRows,
    score: {
      cleanShifts,
      errorShifts,
      excludedRows: mappedRows.filter((row) => row.scoreState === "excluded")
        .length,
      percentage: scorableShifts
        ? roundPercentage((cleanShifts / scorableShifts) * 100)
        : null,
      scorableShifts,
      unavailableLateRows: mappedRows.filter(
        (row) => row.scoreState === "unscorable"
      ).length
    }
  };
}

export function filterPickerAttendanceRows(
  rows: PickerAttendanceRowViewModel[],
  tab: PickerAttendanceTab
) {
  if (tab === "ALL") {
    return rows;
  }

  if (tab === "CLEAN") {
    return rows.filter((row) => row.scoreState === "clean");
  }

  if (tab === "ERROR") {
    return rows.filter((row) => row.scoreState === "error");
  }

  if (tab === "LATE") {
    return rows.filter((row) => Boolean(row.lateBucket));
  }

  if (tab === "ABSENT") {
    return rows.filter((row) => hasTag(row, "absent"));
  }

  if (tab === "UNDER_8") {
    return rows.filter((row) => hasTag(row, "under_8"));
  }

  return rows.filter((row) => hasTag(row, "over_15"));
}

function toPickerAttendanceRowViewModel(
  row: AttendanceDailyReportRow
): PickerAttendanceRowViewModel {
  const tags: PickerShiftTag[] = [];
  const late = classifyLate(row);

  if (isLeaveRow(row)) {
    tags.push({
      kind: row.calculatedStatus === "OFF_DAY" ? "off_day" : "leave",
      label: row.calculatedStatus === "OFF_DAY" ? "Off day" : formatLeaveLabel(row),
      tone: "slate"
    });

    return {
      id: row.id,
      explanation: "This row is not included in your Shift Score.",
      lateBucket: null,
      lateMinutes: null,
      row,
      scoreState: "excluded",
      tags
    };
  }

  if (late.state === "unavailable") {
    tags.push({
      kind: "late_unavailable",
      label: "Late details unavailable",
      tone: "amber"
    });

    return {
      id: row.id,
      explanation:
        "This shift is shown in history, but it is not included in your Shift Score until late details are available.",
      lateBucket: null,
      lateMinutes: null,
      row,
      scoreState: "unscorable",
      tags
    };
  }

  if (late.bucket) {
    tags.push({
      kind: late.bucket.toLowerCase() as PickerShiftTag["kind"],
      label: formatLateBucket(late.bucket),
      tone: "rose"
    });
  }

  if (row.calculatedStatus === "ABSENT") {
    tags.push({ kind: "absent", label: "Absent", tone: "rose" });
  }

  if (row.isUnder8Hours) {
    tags.push({ kind: "under_8", label: "Under 8", tone: "amber" });
  }

  if (row.isOver15Hours) {
    tags.push({ kind: "over_15", label: "Over 15", tone: "amber" });
  }

  const hasError = tags.length > 0;
  if (!hasError) {
    tags.push({ kind: "clean", label: "Clean Shift", tone: "emerald" });
  }

  return {
    id: row.id,
    explanation: buildExplanation(row, late.bucket, late.minutes, hasError),
    lateBucket: late.bucket,
    lateMinutes: late.minutes,
    row,
    scoreState: hasError ? "error" : "clean",
    tags
  };
}

function classifyLate(row: AttendanceDailyReportRow): {
  bucket: "LATE_1" | "LATE_2" | "LATE_3" | null;
  minutes: number | null;
  state: "available" | "unavailable";
} {
  if (isConfirmedLateBucket(row.lateBucket)) {
    return {
      bucket: row.lateBucket,
      minutes: normalizeLateMinutes(row.rawLateMins),
      state: "available"
    };
  }

  const minutes = normalizeLateMinutes(row.rawLateMins);
  if (minutes !== null) {
    return {
      bucket: lateBucketFromMinutes(minutes),
      minutes,
      state: "available"
    };
  }

  if (row.calculatedStatus === "LATE") {
    return { bucket: null, minutes: null, state: "unavailable" };
  }

  return { bucket: null, minutes: null, state: "available" };
}

function lateBucketFromMinutes(minutes: number) {
  if (minutes <= 15) {
    return null;
  }

  if (minutes <= 30) {
    return "LATE_1" as const;
  }

  if (minutes <= 45) {
    return "LATE_2" as const;
  }

  return "LATE_3" as const;
}

function buildExplanation(
  row: AttendanceDailyReportRow,
  bucket: "LATE_1" | "LATE_2" | "LATE_3" | null,
  lateMinutes: number | null,
  hasError: boolean
) {
  if (row.calculatedStatus === "ABSENT") {
    return "This shift was marked absent in the attendance file.";
  }

  if (bucket && lateMinutes !== null) {
    return `Your shift started at ${row.scheduledStartTime ?? "the scheduled time"}. You checked in at ${row.actualCheckinTime ?? "the recorded time"}, so this shift is ${formatLateBucket(bucket)} because you checked in ${lateMinutes} minutes late.`;
  }

  if (!bucket && lateMinutes !== null && lateMinutes > 0) {
    return `You checked in ${lateMinutes} minutes after shift start. This still counts as a clean shift.`;
  }

  if (hasError) {
    return "This shift has an attendance issue shown in the tags.";
  }

  return "This is a clean shift.";
}

function isLeaveRow(row: AttendanceDailyReportRow) {
  return row.calculatedStatus === "OFF_DAY" || leaveStatuses.has(row.calculatedStatus);
}

function formatLeaveLabel(row: AttendanceDailyReportRow) {
  return formatEnum(row.leaveType ?? row.calculatedStatus);
}

function formatLateBucket(bucket: "LATE_1" | "LATE_2" | "LATE_3") {
  return bucket.replace("_", " ").replace("LATE", "Late");
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasTag(
  row: PickerAttendanceRowViewModel,
  tag: PickerShiftTag["kind"]
) {
  return row.tags.some((item) => item.kind === tag);
}

function isConfirmedLateBucket(
  bucket: AttendanceLateBucket | null
): bucket is "LATE_1" | "LATE_2" | "LATE_3" {
  return bucket === "LATE_1" || bucket === "LATE_2" || bucket === "LATE_3";
}

function normalizeLateMinutes(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function roundPercentage(value: number) {
  return Math.round(value * 10) / 10;
}
