import {
  PICKER_ATTENDANCE_DEFAULT_TAB,
  buildPickerAttendanceViewModel,
  filterPickerAttendanceRows,
  type PickerAttendanceTab
} from "./picker-self-attendance-view-model";
import {
  getPickerAttendanceDateToMax,
  normalizePickerAttendanceDateRange
} from "./picker-self-attendance-date-range";
import type { AttendanceDailyReportRow } from "@/lib/api/attendance";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    }
  }
};

{
  const viewModel = buildPickerAttendanceViewModel([
    row({ id: "clean-on-time", calculatedStatus: "ON_TIME" }),
    row({ id: "clean-late-0", calculatedStatus: "LATE", rawLateMins: 0 }),
    row({ id: "clean-late-15", calculatedStatus: "LATE", rawLateMins: 15 }),
    row({ id: "late-1-16", calculatedStatus: "LATE", rawLateMins: 16 }),
    row({ id: "late-1-30", calculatedStatus: "LATE", rawLateMins: 30 }),
    row({ id: "late-2-31", calculatedStatus: "LATE", rawLateMins: 31 }),
    row({ id: "late-2-45", calculatedStatus: "LATE", rawLateMins: 45 }),
    row({ id: "late-3-46", calculatedStatus: "LATE", rawLateMins: 46 }),
    row({ id: "absent", calculatedStatus: "ABSENT" }),
    row({ id: "under-8", isUnder8Hours: true }),
    row({ id: "over-15", isOver15Hours: true })
  ]);

  assert.equal(viewModel.score.scorableShifts, 11);
  assert.equal(viewModel.score.cleanShifts, 3);
  assert.equal(viewModel.score.errorShifts, 8);
  assert.equal(viewModel.score.percentage, 27.3);
  assert.equal(viewModel.buckets.late1, 2);
  assert.equal(viewModel.buckets.late2, 2);
  assert.equal(viewModel.buckets.late3, 1);
}

{
  const viewModel = buildPickerAttendanceViewModel([
    row({ id: "leave", calculatedStatus: "ANNUAL_LEAVE" }),
    row({ id: "off-day", calculatedStatus: "OFF_DAY" }),
    row({ id: "unavailable", calculatedStatus: "LATE", rawLateMins: null }),
    row({ id: "clean", calculatedStatus: "ON_TIME" })
  ]);

  assert.equal(viewModel.score.scorableShifts, 1);
  assert.equal(viewModel.score.cleanShifts, 1);
  assert.equal(viewModel.score.excludedRows, 2);
  assert.equal(viewModel.score.unavailableLateRows, 1);
  assert.equal(viewModel.rows[2]?.scoreState, "unscorable");
  assert.deepEqual(
    viewModel.rows[2]?.tags.map((tag) => tag.label),
    ["Late details unavailable"]
  );
}

{
  const viewModel = buildPickerAttendanceViewModel([
    row({ id: "late-bucket", calculatedStatus: "LATE", lateBucket: "LATE_2", rawLateMins: 12 }),
    row({ id: "clean-late", calculatedStatus: "LATE", rawLateMins: 15 }),
    row({ id: "absent", calculatedStatus: "ABSENT" })
  ]);

  assert.equal(PICKER_ATTENDANCE_DEFAULT_TAB, "ERROR");
  assert.deepEqual(ids(filterPickerAttendanceRows(viewModel.rows, "ERROR")), [
    "late-bucket",
    "absent"
  ]);
  assert.deepEqual(ids(filterPickerAttendanceRows(viewModel.rows, "CLEAN")), [
    "clean-late"
  ]);
  assert.deepEqual(ids(filterPickerAttendanceRows(viewModel.rows, "LATE")), [
    "late-bucket"
  ]);
  assert.equal(viewModel.rows[0]?.lateBucket, "LATE_2");
}

{
  assert.deepEqual(
    normalizePickerAttendanceDateRange({
      dateFrom: "2026-04-28",
      dateTo: "2026-05-03",
      maxDate: "2026-06-01"
    }),
    {
      dateFrom: "2026-04-28",
      dateTo: "2026-04-30"
    }
  );
  assert.deepEqual(
    normalizePickerAttendanceDateRange({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-15",
      maxDate: "2026-06-01"
    }),
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-01"
    }
  );
  assert.equal(getPickerAttendanceDateToMax("2026-05-03", "2026-06-01"), "2026-05-31");
}

function ids(rows: Array<{ id: string }>) {
  return rows.map((item) => item.id);
}

function row(
  overrides: Partial<AttendanceDailyReportRow> & { id: string }
): AttendanceDailyReportRow {
  return {
    actualCheckinTime: "09:00",
    actualCheckoutTime: "18:00",
    actualWorkDurationHours: 9,
    calculatedStatus: "ON_TIME",
    chargeableLateMins: null,
    isOver15Hours: false,
    isUnder8Hours: false,
    isWorkingDay: true,
    issuesCount: 0,
    lateBucket: null,
    leaveType: null,
    pickerName: "Aya Picker",
    personName: "Aya Picker",
    personRole: "PICKER",
    identifierType: "SHOPPER_ID",
    identifierValue: "SHP-1",
    rawLateMins: null,
    scheduledEndTime: "18:00",
    scheduledStartTime: "09:00",
    shiftDate: "2026-05-25",
    shiftName: "Morning Shift",
    shopperId: "111",
    reportedChainId: null,
    reportedLocationCode: null,
    reportedLocationName: null,
    reportedLocationRaw: null,
    reportedVendorId: null,
    locationMappingStatus: "NOT_CHECKED",
    sourceDesignation: null,
    sourceLocation: "Carrefour",
    sourceSubDivision: "Port Fuad",
    userId: "user-1",
    ...overrides,
    id: overrides.id
  };
}

void (null as PickerAttendanceTab | null);
