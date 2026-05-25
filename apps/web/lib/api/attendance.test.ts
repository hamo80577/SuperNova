import {
  buildAttendanceImportConfirmPath,
  buildAttendanceImportPreviewFormData,
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

{
  const file = new File(["attendance"], "mtd.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const formData = buildAttendanceImportPreviewFormData(file, {
    uploadDate: "2026-05-09"
  });

  assert.equal(formData.get("file"), file);
  assert.equal(formData.get("uploadDate"), "2026-05-09");
}

{
  const file = new File(["attendance"], "mtd.xlsx");
  const formData = buildAttendanceImportPreviewFormData(file, {
    uploadDate: " "
  });

  assert.equal(formData.get("file"), file);
  assert.equal(formData.has("uploadDate"), false);
}

{
  assert.equal(
    buildAttendanceImportConfirmPath("batch-123"),
    "/attendance/imports/batch-123/confirm"
  );
}
