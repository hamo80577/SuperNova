import { type AnnualLeavePreview } from "@/lib/api/requests";
import { isAnnualLeaveSubmitBlocked } from "./annual-leave-gating";

function preview(overrides: Partial<AnnualLeavePreview> = {}): AnnualLeavePreview {
  return {
    requestedDays: 2,
    officialRemainingDays: 17.5,
    heldDays: 0,
    availableToRequestDays: 17.5,
    availableAfterRequestDays: 15.5,
    eligibilityStatus: "ELIGIBLE",
    eligibleFrom: null,
    blockingReasons: [],
    ...overrides
  };
}

const cases: Array<{
  scenario: string;
  input: Parameters<typeof isAnnualLeaveSubmitBlocked>[0];
  blocked: boolean;
}> = [
  {
    scenario: "eligible preview with spare balance allows submit",
    input: { canPreview: true, previewing: false, preview: preview() },
    blocked: false
  },
  {
    scenario: "incomplete form (cannot preview) blocks submit",
    input: { canPreview: false, previewing: false, preview: null },
    blocked: true
  },
  {
    scenario: "in-flight preview blocks submit",
    input: { canPreview: true, previewing: true, preview: null },
    blocked: true
  },
  {
    scenario: "missing preview result blocks submit",
    input: { canPreview: true, previewing: false, preview: null },
    blocked: true
  },
  {
    scenario: "any backend blocking reason blocks submit",
    input: {
      canPreview: true,
      previewing: false,
      preview: preview({ blockingReasons: ["Not eligible for annual leave yet."] })
    },
    blocked: true
  },
  {
    scenario: "negative post-request balance blocks submit even with no reasons",
    input: {
      canPreview: true,
      previewing: false,
      preview: preview({ availableToRequestDays: 1, availableAfterRequestDays: -1 })
    },
    blocked: true
  }
];

let failures = 0;
for (const testCase of cases) {
  const actual = isAnnualLeaveSubmitBlocked(testCase.input);
  if (actual !== testCase.blocked) {
    failures += 1;
    console.error(
      `FAIL: ${testCase.scenario} — expected blocked=${testCase.blocked}, got ${actual}`
    );
  }
}

if (failures > 0) {
  throw new Error(`${failures} annual-leave gating case(s) failed.`);
}

console.log(`annual-leave gating: ${cases.length} cases passed.`);
