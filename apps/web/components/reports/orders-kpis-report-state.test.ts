import {
  backToOrdersKpisVendors,
  clearOrdersKpisReportScope,
  defaultOrdersKpisReportFilters,
  drillDownOrdersKpisChainRow,
  drillDownOrdersKpisVendorRow,
  parseOrdersKpisReportFilters,
  selectOrdersKpisReportView,
  serializeOrdersKpisReportFilters
} from "./orders-kpis-report-state";

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
  assert.deepEqual(defaultOrdersKpisReportFilters("2026-06-07"), {
    chainId: "",
    dateFrom: "2026-06-07",
    dateTo: "2026-06-07",
    page: 1,
    pageSize: 50,
    pickerSearch: "",
    sortBy: "uhoRate",
    sortDirection: "desc",
    vendorId: "",
    view: "CHAIN"
  });
}

{
  const filters = parseOrdersKpisReportFilters(
    new URLSearchParams(
      "view=PICKER&dateFrom=2026-06-01&dateTo=2026-06-08&chainId=chain-1&vendorId=vendor-1&pickerSearch=Aya&page=3&pageSize=25&sortBy=totalOrders&sortDirection=asc"
    ),
    "2026-06-07"
  );

  assert.deepEqual(filters, {
    chainId: "chain-1",
    dateFrom: "2026-06-01",
    dateTo: "2026-06-08",
    page: 3,
    pageSize: 25,
    pickerSearch: "Aya",
    sortBy: "totalOrders",
    sortDirection: "asc",
    vendorId: "vendor-1",
    view: "PICKER"
  });
}

{
  const filters = parseOrdersKpisReportFilters(
    new URLSearchParams(
      "view=BAD&dateFrom=tomorrow&dateTo=2026-06-06&page=0&pageSize=999&sortBy=bad&sortDirection=sideways"
    ),
    "2026-06-07"
  );

  assert.deepEqual(filters, defaultOrdersKpisReportFilters("2026-06-07"));
}

{
  assert.equal(
    serializeOrdersKpisReportFilters({
      ...defaultOrdersKpisReportFilters("2026-06-07"),
      chainId: "chain-1",
      page: 2,
      pickerSearch: "Aya Picker",
      sortDirection: "asc",
      view: "VENDOR"
    }),
    "dateFrom=2026-06-07&dateTo=2026-06-07&view=VENDOR&chainId=chain-1&pickerSearch=Aya+Picker&sortDirection=asc&page=2"
  );
}

{
  const current = {
    ...defaultOrdersKpisReportFilters("2026-06-07"),
    page: 4,
    pickerSearch: "Aya"
  };

  assert.deepEqual(
    drillDownOrdersKpisChainRow(current, {
      chainId: "chain-1",
      chainName: "Crispy",
      kind: "CHAIN",
      notOnTime: 2,
      oos: 3,
      partialRefund: 4,
      pickerCount: 6,
      priceModified: 5,
      qcFailedOrders: 1,
      totalOrders: 100,
      uho: 10,
      uhoRate: 10,
      vendorCount: 2
    }),
    {
      ...current,
      chainId: "chain-1",
      page: 1,
      vendorId: "",
      view: "VENDOR"
    }
  );
}

{
  assert.equal(
    drillDownOrdersKpisChainRow(defaultOrdersKpisReportFilters("2026-06-07"), {
      chainId: null,
      chainName: "Unmapped Chain",
      kind: "CHAIN",
      notOnTime: 0,
      oos: 0,
      partialRefund: 0,
      pickerCount: 1,
      priceModified: 0,
      qcFailedOrders: 0,
      totalOrders: 1,
      uho: 0,
      uhoRate: 0,
      vendorCount: 1
    }),
    null
  );
}

{
  const current = {
    ...defaultOrdersKpisReportFilters("2026-06-07"),
    chainId: "chain-1",
    page: 2,
    view: "VENDOR" as const
  };

  assert.deepEqual(
    drillDownOrdersKpisVendorRow(current, {
      chainId: "chain-1",
      chainName: "Crispy",
      kind: "VENDOR",
      notOnTime: 2,
      oos: 3,
      partialRefund: 4,
      pickerCount: 8,
      priceModified: 5,
      qcFailedOrders: 1,
      sourceVendorId: "source-1",
      totalOrders: 100,
      uho: 10,
      uhoRate: 10,
      vendorId: "vendor-1",
      vendorName: "Vendor 1234 - Maadi"
    }),
    {
      ...current,
      page: 1,
      vendorId: "vendor-1",
      view: "PICKER"
    }
  );
}

{
  const current = {
    ...defaultOrdersKpisReportFilters("2026-06-07"),
    chainId: "chain-1",
    vendorId: "vendor-1",
    view: "PICKER" as const
  };

  assert.deepEqual(selectOrdersKpisReportView(current, "CHAIN"), {
    ...current,
    chainId: "",
    page: 1,
    vendorId: "",
    view: "CHAIN"
  });
  assert.deepEqual(selectOrdersKpisReportView(current, "VENDOR"), {
    ...current,
    page: 1,
    vendorId: "",
    view: "VENDOR"
  });
  assert.deepEqual(selectOrdersKpisReportView(current, "PICKER"), {
    ...current,
    page: 1,
    view: "PICKER"
  });
}

{
  const current = {
    ...defaultOrdersKpisReportFilters("2026-06-07"),
    chainId: "chain-1",
    pickerSearch: "Aya",
    vendorId: "vendor-1",
    view: "PICKER" as const
  };

  assert.deepEqual(clearOrdersKpisReportScope(current), {
    ...current,
    chainId: "",
    page: 1,
    vendorId: "",
    view: "CHAIN"
  });
}

{
  const current = {
    ...defaultOrdersKpisReportFilters("2026-06-07"),
    chainId: "chain-1",
    vendorId: "vendor-1",
    view: "PICKER" as const
  };

  assert.deepEqual(backToOrdersKpisVendors(current), {
    ...current,
    page: 1,
    vendorId: "",
    view: "VENDOR"
  });
}
