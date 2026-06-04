import {
  getAttendanceQuickRange,
  getNextAttendanceRangeSelection
} from "./attendance-date-range";

const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    }
  }
};

{
  assert.deepEqual(getAttendanceQuickRange("yesterday", "2026-06-03"), {
    dateFrom: "2026-06-03",
    dateTo: "2026-06-03"
  });
  assert.deepEqual(getAttendanceQuickRange("lastWeek", "2026-06-03"), {
    dateFrom: "2026-05-28",
    dateTo: "2026-06-03"
  });
  assert.deepEqual(getAttendanceQuickRange("thisMonth", "2026-06-03"), {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03"
  });
}

{
  assert.deepEqual(
    getNextAttendanceRangeSelection({
      activeBoundary: "start",
      currentRange: {
        dateFrom: "2026-06-01",
        dateTo: "2026-06-03"
      },
      selectedDate: "2026-05-25"
    }),
    {
      activeBoundary: "end",
      apply: false,
      range: {
        dateFrom: "2026-05-25",
        dateTo: "2026-05-25"
      }
    }
  );
  assert.deepEqual(
    getNextAttendanceRangeSelection({
      activeBoundary: "end",
      currentRange: {
        dateFrom: "2026-05-25",
        dateTo: "2026-05-25"
      },
      selectedDate: "2026-05-31"
    }),
    {
      activeBoundary: "end",
      apply: true,
      range: {
        dateFrom: "2026-05-25",
        dateTo: "2026-05-31"
      }
    }
  );
}
