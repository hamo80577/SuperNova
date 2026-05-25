import { getAttendanceArchiveSummaryText } from "./attendance-report-page";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

const overviewCounts = {
  branchCount: 3,
  chainCount: 2
};

assert.equal(
  getAttendanceArchiveSummaryText("admin", overviewCounts),
  "3 Branches / 2 Chains"
);

assert.equal(
  getAttendanceArchiveSummaryText("area-manager", overviewCounts),
  "3 Branches / 2 Chains"
);

assert.equal(
  getAttendanceArchiveSummaryText("champ", overviewCounts),
  "3 Assigned Branches"
);
