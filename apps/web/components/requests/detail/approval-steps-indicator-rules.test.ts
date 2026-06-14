import assert from "node:assert/strict";

import { buildAnnualLeaveStepDefinitions } from "./approval-steps-indicator-rules";

const submittedBy = {
  nameEn: "Picker One"
};

const pickerAnnualDefinitions = buildAnnualLeaveStepDefinitions({
  approvals: [
    { step: "ADMIN_FINAL_APPROVAL" },
    { step: "CHAMP_APPROVAL" },
    { step: "AREA_MANAGER_APPROVAL" }
  ],
  createdBy: submittedBy
});

assert.deepEqual(
  pickerAnnualDefinitions.map((definition) => definition.id),
  [
    "submitted",
    "annual-champ-approval",
    "annual-area-manager-approval",
    "annual-admin-final-approval",
    "annual-leave-approved"
  ]
);
assert.deepEqual(
  pickerAnnualDefinitions.map((definition) => definition.title),
  [
    "Request Submitted",
    "Champ Approval",
    "Area Manager Approval",
    "Admin Final Approval",
    "Annual Leave Approved"
  ]
);

const champAnnualDefinitions = buildAnnualLeaveStepDefinitions({
  approvals: [
    { step: "ADMIN_FINAL_APPROVAL" },
    { step: "AREA_MANAGER_APPROVAL" }
  ],
  createdBy: submittedBy
});

assert.deepEqual(
  champAnnualDefinitions.map((definition) => definition.id),
  [
    "submitted",
    "annual-area-manager-approval",
    "annual-admin-final-approval",
    "annual-leave-approved"
  ]
);

console.log("approval steps indicator rules: annual leave cases passed.");
