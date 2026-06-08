import {
  canApproveOrdersKpiReview,
  groupOrdersKpiImportIssues
} from "./orders-kpis-import-review";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

const issueBase = {
  fieldName: null,
  message: "message",
  rowNumber: 2,
  shopperId: "SHOPPER-1"
};

{
  const groups = groupOrdersKpiImportIssues([
    {
      ...issueBase,
      issueCode: "MISSING_SHOPPER_ID",
      message: "shopperId is required and cannot be No data.",
      severity: "ERROR"
    },
    {
      ...issueBase,
      issueCode: "MISSING_SHOPPER_ID",
      message: "shopperId is required and cannot be No data.",
      rowNumber: 3,
      severity: "ERROR"
    },
    {
      ...issueBase,
      issueCode: "UNMAPPED_VENDOR_ID",
      severity: "WARNING"
    }
  ]);

  assert.equal(groups.blocking.length, 1);
  assert.equal(groups.blocking[0]?.count, 2);
  assert.equal(groups.blocking[0]?.label, "Missing shopper ID");
  assert.equal(
    groups.blocking[0]?.description,
    "shopperId is required and cannot be No data."
  );
  assert.equal(groups.warnings.length, 1);
  assert.equal(groups.warnings[0]?.label, "Unmapped vendor ID");
}

{
  assert.equal(
    canApproveOrdersKpiReview({
      acknowledged: false,
      preview: {
        batchId: "batch-1",
        canApproveValidRows: true,
        stagingRowCount: 3,
        status: "NEEDS_REVIEW"
      }
    }),
    false
  );
  assert.equal(
    canApproveOrdersKpiReview({
      acknowledged: true,
      preview: {
        batchId: "batch-1",
        canApproveValidRows: true,
        stagingRowCount: 3,
        status: "NEEDS_REVIEW"
      }
    }),
    true
  );
  assert.equal(
    canApproveOrdersKpiReview({
      acknowledged: true,
      preview: {
        batchId: "batch-1",
        canApproveValidRows: true,
        stagingRowCount: 0,
        status: "NEEDS_REVIEW"
      }
    }),
    false
  );
}
