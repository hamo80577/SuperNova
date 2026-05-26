import {
  attendanceApi,
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
    duplicateResolutionRowNumbers: [3, 9],
    uploadDate: "2026-05-09"
  });

  assert.equal(formData.get("file"), file);
  assert.equal(formData.get("uploadDate"), "2026-05-09");
  assert.equal(formData.get("duplicateResolutionRowNumbers"), "[3,9]");
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

void runCacheInvalidationTest();

async function runCacheInvalidationTest() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; path: string }> = [];
  const reportResponses = [
    {
      activeBatchId: "old-batch",
      coverageEndDate: "2026-05-08"
    },
    {
      activeBatchId: "new-batch",
      coverageEndDate: "2026-05-09"
    }
  ];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname + url.search });

    if (url.pathname === "/api/attendance/reports/daily") {
      return jsonResponse(reportResponses.shift() ?? reportResponses[0]);
    }

    if (
      url.pathname === "/api/attendance/imports/batch-123/confirm" &&
      method === "POST"
    ) {
      return jsonResponse({
        batchId: "batch-123",
        periodMonth: "2026-05",
        status: "ACTIVE",
        previousActiveBatchId: "old-batch",
        confirmedAt: "2026-05-10T10:00:00.000Z"
      });
    }

    return jsonResponse({ message: "Not found" }, 404);
  };

  try {
    const query = { periodMonth: "2026-05", page: 1 };
    const first = await attendanceApi.dailyReport(query);
    const cached = await attendanceApi.dailyReport(query);

    assert.equal(first.activeBatchId, "old-batch");
    assert.equal(cached.activeBatchId, "old-batch");

    await attendanceApi.confirmImport("batch-123");
    const refreshed = await attendanceApi.dailyReport(query);

    assert.equal(refreshed.activeBatchId, "new-batch");
    assert.deepEqual(calls, [
      {
        method: "GET",
        path: "/api/attendance/reports/daily?periodMonth=2026-05&page=1"
      },
      {
        method: "POST",
        path: "/api/attendance/imports/batch-123/confirm"
      },
      {
        method: "GET",
        path: "/api/attendance/reports/daily?periodMonth=2026-05&page=1"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status
  });
}
