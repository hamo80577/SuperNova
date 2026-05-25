import {
  buildAttendanceDailyReportPath,
  type AttendanceDailyReportQuery
} from "./attendance";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

{
  const query: AttendanceDailyReportQuery = {
    periodMonth: "2026-05",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-06",
    pickerSearch: "Aya Picker",
    shopperId: "SHOPPER-001",
    status: "LATE",
    lateOnly: true,
    absentOnly: false,
    onLeaveOnly: true,
    page: 2,
    pageSize: 50
  };

  assert.equal(
    buildAttendanceDailyReportPath(query),
    "/attendance/reports/daily?periodMonth=2026-05&dateFrom=2026-05-01&dateTo=2026-05-06&shopperId=SHOPPER-001&pickerSearch=Aya+Picker&status=LATE&lateOnly=true&onLeaveOnly=true&page=2&pageSize=50"
  );
}

{
  assert.equal(
    buildAttendanceDailyReportPath({
      periodMonth: "2026-05",
      pickerSearch: "",
      lateOnly: false,
      absentOnly: undefined,
      page: 1
    }),
    "/attendance/reports/daily?periodMonth=2026-05&page=1"
  );
}
