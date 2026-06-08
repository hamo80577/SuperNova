import {
  buildOrdersKpiApproveValidRowsPath,
  buildOrdersKpiDailyReportPath,
  buildOrdersKpiImportConfirmPath,
  buildOrdersKpiImportPreviewFormData,
  buildOrdersKpiPerformanceReportPath,
  buildOrdersKpiRejectImportPath,
  ordersKpisApi
} from "./orders-kpis";

const assert = {
  deepEqual(actual: unknown, expected: unknown) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    }
  },
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

{
  assert.equal(
    buildOrdersKpiDailyReportPath({
      chainId: "chain-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-08",
      page: 2,
      pageSize: 50,
      pickerSearch: "Aya Picker",
      shopperId: "SHOPPER-001",
      sortBy: "successRate",
      sortDirection: "desc",
      vendorId: "branch-1"
    }),
    "/orders-kpis/reports/daily?dateFrom=2026-06-01&dateTo=2026-06-08&shopperId=SHOPPER-001&pickerSearch=Aya+Picker&vendorId=branch-1&chainId=chain-1&sortBy=successRate&sortDirection=desc&page=2&pageSize=50"
  );
}

{
  assert.equal(
    buildOrdersKpiDailyReportPath({
      chainId: " ",
      page: 1,
      pageSize: 50,
      pickerSearch: "",
      sortDirection: "asc"
    }),
    "/orders-kpis/reports/daily?sortDirection=asc&page=1&pageSize=50"
  );
}

{
  assert.equal(
    buildOrdersKpiPerformanceReportPath({
      chainId: "chain-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-08",
      page: 2,
      pageSize: 25,
      pickerSearch: "Aya Picker",
      sortBy: "uhoRate",
      sortDirection: "desc",
      vendorId: "vendor-1",
      view: "PICKER"
    }),
    "/orders-kpis/reports/performance?dateFrom=2026-06-01&dateTo=2026-06-08&view=PICKER&chainId=chain-1&vendorId=vendor-1&pickerSearch=Aya+Picker&sortBy=uhoRate&sortDirection=desc&page=2&pageSize=25"
  );
}

{
  assert.equal(
    buildOrdersKpiPerformanceReportPath({
      chainId: " ",
      page: 1,
      pageSize: 50,
      pickerSearch: "",
      sortDirection: "asc"
    }),
    "/orders-kpis/reports/performance?sortDirection=asc&page=1&pageSize=50"
  );
}

{
  const file = new File(["orders"], "orders-kpis.csv", { type: "text/csv" });
  const formData = buildOrdersKpiImportPreviewFormData(file);

  assert.equal(formData.get("file"), file);
}

{
  assert.equal(
    buildOrdersKpiImportConfirmPath("batch 123"),
    "/orders-kpis/imports/batch%20123/confirm"
  );
}

{
  assert.equal(
    buildOrdersKpiApproveValidRowsPath("batch 123"),
    "/orders-kpis/imports/batch%20123/approve-valid-rows"
  );
}

{
  assert.equal(
    buildOrdersKpiRejectImportPath("batch 123"),
    "/orders-kpis/imports/batch%20123/reject"
  );
}

void runCacheInvalidationTest();

async function runCacheInvalidationTest() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; path: string }> = [];
  const reportResponses = [
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-08",
      rows: [{ id: "old-row" }],
      summary: { totalOrders: 10 }
    },
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-08",
      rows: [{ id: "new-row" }],
      summary: { totalOrders: 20 }
    },
    {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-08",
      rows: [{ id: "approved-row" }],
      summary: { totalOrders: 30 }
    }
  ];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname + url.search });

    if (url.pathname === "/api/orders-kpis/reports/daily") {
      return jsonResponse(reportResponses.shift() ?? reportResponses[0]);
    }

    if (
      url.pathname === "/api/orders-kpis/imports/batch-123/confirm" &&
      method === "POST"
    ) {
      return jsonResponse({
        batchId: "batch-123",
        confirmedAt: "2026-06-08T10:00:00.000Z",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-08",
        errorRows: 0,
        insertedCount: 1,
        rowCount: 1,
        status: "CONFIRMED",
        updatedCount: 0,
        warningRows: 0
      });
    }

    if (
      url.pathname ===
        "/api/orders-kpis/imports/batch-review/approve-valid-rows" &&
      method === "POST"
    ) {
      assert.equal(
        init?.body,
        JSON.stringify({ acknowledgeSkippedErrorRows: true })
      );
      return jsonResponse({
        approvedWithErrors: true,
        batchId: "batch-review",
        confirmedAt: "2026-06-08T10:00:00.000Z",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-08",
        errorRows: 1,
        insertedCount: 1,
        rowCount: 2,
        skippedErrorRows: 1,
        status: "CONFIRMED",
        updatedCount: 0,
        warningRows: 0
      });
    }

    if (
      url.pathname === "/api/orders-kpis/imports/batch-review/reject" &&
      method === "POST"
    ) {
      return jsonResponse({
        batchId: "batch-review",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-08",
        errorRows: 1,
        rejectedAt: "2026-06-08T10:00:00.000Z",
        rowCount: 2,
        stagingRowCount: 1,
        status: "REJECTED",
        warningRows: 0
      });
    }

    return jsonResponse({ message: "Not found" }, 404);
  };

  try {
    const query = { dateFrom: "2026-06-01", dateTo: "2026-06-08", page: 1 };
    const first = await ordersKpisApi.dailyReport(query);
    const cached = await ordersKpisApi.dailyReport(query);

    assert.equal(first.rows[0]?.id, "old-row");
    assert.equal(cached.rows[0]?.id, "old-row");

    await ordersKpisApi.confirmImport("batch-123");
    const refreshed = await ordersKpisApi.dailyReport(query);

    assert.equal(refreshed.rows[0]?.id, "new-row");
    await ordersKpisApi.approveValidRows("batch-review", {
      acknowledgeSkippedErrorRows: true
    });
    const afterApprove = await ordersKpisApi.dailyReport(query);
    assert.equal(afterApprove.rows[0]?.id, "approved-row");
    await ordersKpisApi.rejectImport("batch-review");
    assert.deepEqual(calls, [
      {
        method: "GET",
        path: "/api/orders-kpis/reports/daily?dateFrom=2026-06-01&dateTo=2026-06-08&page=1"
      },
      {
        method: "POST",
        path: "/api/orders-kpis/imports/batch-123/confirm"
      },
      {
        method: "GET",
        path: "/api/orders-kpis/reports/daily?dateFrom=2026-06-01&dateTo=2026-06-08&page=1"
      },
      {
        method: "POST",
        path: "/api/orders-kpis/imports/batch-review/approve-valid-rows"
      },
      {
        method: "GET",
        path: "/api/orders-kpis/reports/daily?dateFrom=2026-06-01&dateTo=2026-06-08&page=1"
      },
      {
        method: "POST",
        path: "/api/orders-kpis/imports/batch-review/reject"
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
