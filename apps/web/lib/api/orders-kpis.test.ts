import assert from "node:assert/strict";

import {
  buildOrdersKpiImportConfirmReplacePath,
  buildOrdersKpiImportPreviewFormData,
  buildOrdersKpiImportRejectPath,
  buildOrdersKpiPerformanceReportPath,
  buildOrdersKpiTargetSettingsPath,
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
      pickerId: "picker-1",
      pickerSearch: "99348",
      search: "Vendor A",
      sortBy: "unhealthyRate",
      sortDirection: "asc",
      sourcePickerKey: null,
      sourceShopperId: null,
      unmappedOnly: true,
      view: "VENDOR"
    }),
    "/orders-kpis/reports/performance?dateFrom=2026-06-01&dateTo=2026-06-09&view=VENDOR&chainId=chain-1&unmappedOnly=true&pickerId=picker-1&search=Vendor+A&pickerSearch=99348&page=2&pageSize=25&sortBy=unhealthyRate&sortDirection=asc"
  );
  assert.equal(
    buildOrdersKpiTargetSettingsPath(),
    "/orders-kpis/settings/targets"
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
  await ordersKpisApi.updateTargetSettings({
    uhoRateTarget: 8,
    notOnTimeRateTarget: 10,
    qcFailedRateTarget: 5,
    partialRefundRateTarget: 3,
    oosRateTarget: 3,
    priceModifiedRateTarget: 3
  });

  const [confirmRequest, rejectRequest, targetsRequest] = requests;
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
  assert.ok(targetsRequest.url.endsWith("/api/orders-kpis/settings/targets"));
  assert.equal(targetsRequest.init?.method, "PUT");
  assert.equal(
    targetsRequest.init?.body,
    JSON.stringify({
      uhoRateTarget: 8,
      notOnTimeRateTarget: 10,
      qcFailedRateTarget: 5,
      partialRefundRateTarget: 3,
      oosRateTarget: 3,
      priceModifiedRateTarget: 3
    })
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
