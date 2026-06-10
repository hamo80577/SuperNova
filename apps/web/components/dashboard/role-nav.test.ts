import assert from "node:assert/strict";

import { roleNavigation } from "./role-nav";

function hrefs(role: keyof typeof roleNavigation) {
  return roleNavigation[role]
    .map((item) => item.href)
    .filter((href): href is string => Boolean(href));
}

function reportsSectionLabels(role: keyof typeof roleNavigation) {
  return roleNavigation[role]
    .filter((item) => item.section === "Reports")
    .map((item) => item.label);
}

function run() {
  for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
    assert.deepEqual(
      reportsSectionLabels(role),
      ["Reports", "Imports"],
      `${role} Reports section should only contain the two center links`
    );
    assert.ok(hrefs(role).includes("/admin/reports"));
    assert.ok(hrefs(role).includes("/admin/imports"));
    assert.ok(!hrefs(role).includes("/admin/reports/orders-kpi"));
    assert.ok(!hrefs(role).includes("/admin/imports/orders-kpi"));
    assert.ok(!hrefs(role).includes("/admin/reports/attendance"));
    assert.ok(!hrefs(role).includes("/admin/attendance/imports"));
  }

  assert.deepEqual(reportsSectionLabels("AREA_MANAGER"), ["Reports"]);
  assert.ok(hrefs("AREA_MANAGER").includes("/area-manager/reports"));
  assert.ok(
    !hrefs("AREA_MANAGER").some((href) => href.includes("/imports")),
    "Area Manager must not see import links"
  );

  assert.deepEqual(reportsSectionLabels("CHAMP"), ["Reports"]);
  assert.ok(hrefs("CHAMP").includes("/champ/reports"));
  assert.ok(
    !hrefs("CHAMP").some((href) => href.includes("/imports")),
    "Champ must not see import links"
  );

  assert.ok(
    !hrefs("PICKER").some((href) => href.includes("orders-kpi")),
    "Picker must not see Orders KPI links"
  );

  console.log("role-nav tests passed");
}

run();
