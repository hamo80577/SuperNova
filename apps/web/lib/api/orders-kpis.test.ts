import assert from "node:assert/strict";

import {
  buildOrdersKpiImportConfirmReplacePath,
  buildOrdersKpiImportPreviewFormData,
  buildOrdersKpiImportRejectPath,
  buildOrdersKpiPerformanceReportPath,
  ordersKpisApi
} from "./orders-kpis";

const originalFetch = globalThis.fetch;

async function run() {
  const previewFile = new File(["source"], "orders-kpi.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const formData = buildOrdersKpiImportPreviewFormData(previewFile);
  assert.equal(formData.get("file"), previewFile);

  assert.equal(
    buildOrdersKpiImportConfirmReplacePath("batch-123"),
    "/orders-kpis/imports/batch-123/confirm-replace"
  );
  assert.equal(
    buildOrdersKpiImportRejectPath("batch-123"),
    "/orders-kpis/imports/batch-123/reject"
  );
  assert.equal(
    buildOrdersKpiPerformanceReportPath({
      chainId: "chain-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-09",
      page: 2,
      pageSize: 25,
      pickerSearch: "99348",
      sortBy: "unhealthyRate",
      sortDirection: "asc",
      unmappedOnly: true,
      view: "VENDOR"
    }),
    "/orders-kpis/reports/performance?dateFrom=2026-06-01&dateTo=2026-06-09&view=VENDOR&chainId=chain-1&unmappedOnly=true&pickerSearch=99348&page=2&pageSize=25&sortBy=unhealthyRate&sortDirection=asc"
  );

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: input.toString(), init });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  }) as typeof fetch;

  await ordersKpisApi.confirmReplaceImport("batch-123", {
    acknowledgeReplaceDates: true,
    acknowledgeSkippedErrorRows: true,
    approveValidRowsOnly: true
  });
  await ordersKpisApi.rejectImport("batch-123", {
    reason: "Uploaded wrong report period."
  });

  const [confirmRequest, rejectRequest] = requests;
  assert.ok(confirmRequest.url.endsWith("/api/orders-kpis/imports/batch-123/confirm-replace"));
  assert.equal(confirmRequest.init?.method, "POST");
  assert.equal(
    confirmRequest.init?.body,
    JSON.stringify({
      acknowledgeReplaceDates: true,
      acknowledgeSkippedErrorRows: true,
      approveValidRowsOnly: true
    })
  );
  assert.ok(rejectRequest.url.endsWith("/api/orders-kpis/imports/batch-123/reject"));
  assert.equal(rejectRequest.init?.method, "POST");
  assert.equal(
    rejectRequest.init?.body,
    JSON.stringify({ reason: "Uploaded wrong report period." })
  );
}

run()
  .then(() => {
    console.log("orders-kpis api tests passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
