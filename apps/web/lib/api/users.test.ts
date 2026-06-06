import { buildWorkforceSummaryPath } from "./users";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
  }
};

{
  assert.equal(
    buildWorkforceSummaryPath({
      areaManagerId: "",
      champId: "champ-1",
      chainId: "chain-1",
      period: "this-month",
      role: "PICKER",
      vendorId: ""
    }),
    "/users/workforce-summary?period=this-month&role=PICKER&chainId=chain-1&champId=champ-1"
  );
}
