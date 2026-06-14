import type {
  AnnualLeaveRequestSummary,
  ApprovalStep,
  RequestStatus,
  RequestSummary,
  RequestType
} from "./requests";

const assert = {
  ok(value: unknown, message?: string) {
    if (!value) {
      throw new Error(message ?? "Expected a truthy value.");
    }
  },
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

// Fix 1: the new backend enum values are part of the web unions (compile-time
// membership is the real guard — these literals only type-check if present).
{
  const types: RequestType[] = [
    "NEW_HIRE",
    "RESIGNATION",
    "TRANSFER",
    "DEDUCTION",
    "ANNUAL_LEAVE"
  ];
  assert.ok(types.includes("ANNUAL_LEAVE"));

  const statuses: RequestStatus[] = ["DRAFT", "PENDING_CHAMP", "PENDING_ADMIN"];
  assert.ok(statuses.includes("PENDING_CHAMP"));

  const steps: ApprovalStep[] = [
    "CHAMP_APPROVAL",
    "AREA_MANAGER_APPROVAL",
    "ADMIN_FINAL_APPROVAL"
  ];
  assert.ok(steps.includes("CHAMP_APPROVAL"));
}

// Request response types include the annualLeave detail block.
{
  const annualLeave: AnnualLeaveRequestSummary = {
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    requestedDays: 2,
    reason: "Trip",
    contextVendorId: "vendor-1",
    contextChainId: "chain-1",
    balanceCarriedSnapshot: 7,
    balanceAccruedSnapshot: 10.5,
    balanceTakenSnapshot: 0,
    balanceHeldSnapshot: 0,
    availableBeforeRequestSnapshot: 17.5,
    availableAfterRequestSnapshot: 15.5
  };

  const summary: Pick<
    RequestSummary,
    "type" | "status" | "currentStep" | "annualLeave"
  > = {
    type: "ANNUAL_LEAVE",
    status: "PENDING_CHAMP",
    currentStep: "CHAMP_APPROVAL",
    annualLeave
  };

  assert.equal(summary.type, "ANNUAL_LEAVE");
  assert.equal(summary.currentStep, "CHAMP_APPROVAL");
  assert.equal(summary.annualLeave?.requestedDays, 2);
  // annualLeave is nullable for non-annual-leave requests.
  const noLeave: Pick<RequestSummary, "annualLeave"> = { annualLeave: null };
  assert.equal(noLeave.annualLeave, null);
}
