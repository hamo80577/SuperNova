import {
  attendanceApi,
  buildAttendanceImportConfirmPath,
  buildAttendanceImportPreviewFormData,
  buildAttendanceDailyReportPath,
  type AttendanceDailyReportResponse,
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
    branch: "Branch A",
    chain: "Chain Alpha",
    status: "LATE",
    lateOnly: true,
    absentOnly: false,
    onLeaveOnly: true,
    sortBy: "name",
    sortDirection: "desc",
    page: 2,
    pageSize: 50
  };

  assert.equal(
    buildAttendanceDailyReportPath(query),
    "/attendance/reports/daily?periodMonth=2026-05&dateFrom=2026-05-01&dateTo=2026-05-06&shopperId=SHOPPER-001&pickerSearch=Aya+Picker&branch=Branch+A&chain=Chain+Alpha&status=LATE&lateOnly=true&onLeaveOnly=true&sortBy=name&sortDirection=desc&page=2&pageSize=50"
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
  const response: AttendanceDailyReportResponse = {
    activeBatchId: "batch-1",
    analytics: {
      attendanceMix: {
        absent: { count: 1, percentage: 10 },
        attend: { count: 8, percentage: 80 },
        onLeave: { count: 1, percentage: 10 }
      },
      attendanceRate: {
        attendCount: 8,
        delta: {
          direction: "up",
          label: "+2%",
          unit: "percentage_point",
          value: 2
        },
        totalShifts: 10,
        value: 80
      },
      averageLogHours: {
        attendedShiftCount: 8,
        delta: {
          direction: "flat",
          label: "0%",
          unit: "percent",
          value: 0
        },
        formattedValue: "8h",
        value: 8
      },
      lateBuckets: {
        late1: { count: 1, percentage: 10 },
        late2: { count: 1, percentage: 10 },
        late3: { count: 0, percentage: 0 },
        totalLateCount: 2
      },
      performance: {
        problemMix: {
          absent: { count: 1, percentage: 10 },
          all: { count: 2, percentage: 20 },
          late: { count: 1, percentage: 10 },
          over15: { count: 0, percentage: 0 },
          under8: { count: 0, percentage: 0 }
        },
        problemShiftCount: {
          delta: {
            direction: "down",
            label: "-5%",
            unit: "percent",
            value: -5
          },
          value: 2
        },
        validShiftRate: {
          delta: {
            direction: "up",
            label: "+5%",
            unit: "percentage_point",
            value: 5
          },
          totalShifts: 10,
          validShiftCount: 8,
          value: 80
        }
      },
      shiftQuality: {
        cleanShiftRate: {
          delta: {
            direction: "up",
            label: "+5%",
            unit: "percentage_point",
            value: 5
          },
          totalShifts: 10,
          value: 80
        },
        counts: {
          cleanShifts: {
            delta: {
              direction: "up",
              label: "+12.5%",
              unit: "percent",
              value: 12.5
            },
            value: 8
          },
          errorShifts: {
            delta: {
              direction: "down",
              label: "-5%",
              unit: "percent",
              value: -5
            },
            value: 2
          },
          totalShifts: {
            delta: {
              direction: "flat",
              label: "0%",
              unit: "percent",
              value: 0
            },
            value: 10
          }
        }
      },
      workStatusRates: {
        absent: {
          count: 1,
          delta: { direction: "up", label: "+10%", unit: "percentage_point", value: 10 },
          percentage: 10
        },
        all: {
          count: 8,
          delta: { direction: "up", label: "+2%", unit: "percentage_point", value: 2 },
          percentage: 80
        },
        lateOver15: {
          count: 1,
          delta: { direction: "flat", label: "0%", unit: "percentage_point", value: 0 },
          percentage: 10
        },
        onLeave: {
          count: 1,
          delta: { direction: "down", label: "-5%", unit: "percentage_point", value: -5 },
          percentage: 10
        },
        onTime: {
          count: 7,
          delta: { direction: "up", label: "+7%", unit: "percentage_point", value: 7 },
          percentage: 70
        }
      },
      range: {
        comparisonDateFrom: "2026-05-01",
        comparisonDateTo: "2026-05-01",
        dateFrom: "2026-05-02",
        dateTo: "2026-05-02",
        days: 1
      },
      pickerCount: 8
    },
    coverageEndDate: "2026-05-02",
    coverageStartDate: "2026-05-01",
    expectedCoverageEndDate: "2026-05-02",
    filterOptions: {
      branches: ["Branch A"],
      chains: ["Chain Alpha"],
      statuses: ["ON_TIME", "LATE"]
    },
    pagination: {
      page: 1,
      pageSize: 25,
      totalPages: 1,
      totalRows: 0
    },
    periodMonth: "2026-05",
    rows: [],
    summary: {
      absentCount: 1,
      leaveCount: 1,
      lateCount: 2,
      offDayCount: 0,
      onTimeCount: 6,
      over15HoursCount: 0,
      totalChargeableLateMins: 0,
      totalRawLateMins: 0,
      totalRows: 10,
      under8HoursCount: 0
    }
  };

  assert.equal(response.analytics.performance.validShiftRate.value, 80);
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
  assert.equal(formData.has("periodMonth"), false);
  assert.equal(formData.has("importMode"), false);
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
  const file = new File(["attendance"], "historical.xlsx");
  const formData = buildAttendanceImportPreviewFormData(file, {
    importMode: "HISTORICAL_MONTH",
    periodMonth: "2026-04"
  });

  assert.equal(formData.get("file"), file);
  assert.equal(formData.get("importMode"), "HISTORICAL_MONTH");
  assert.equal(formData.get("periodMonth"), "2026-04");
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
