import assert from "node:assert/strict";

import { parseAttendanceLocation } from "../src/attendance/attendance-location-parser";

async function main() {
  assert.deepEqual(
    parseAttendanceLocation("123456 - Branch"),
    {
      raw: "123456 - Branch",
      code: "123456",
      name: "Branch",
      status: "PARSED"
    }
  );

  assert.deepEqual(
    parseAttendanceLocation("123456-Branch"),
    {
      raw: "123456-Branch",
      code: "123456",
      name: "Branch",
      status: "PARSED"
    }
  );

  assert.deepEqual(
    parseAttendanceLocation("All Vendors"),
    {
      raw: "All Vendors",
      code: null,
      name: "All Vendors",
      status: "NO_CODE"
    }
  );

  assert.deepEqual(parseAttendanceLocation("   "), {
    raw: null,
    code: null,
    name: null,
    status: "MISSING"
  });

  assert.deepEqual(parseAttendanceLocation(null), {
    raw: null,
    code: null,
    name: null,
    status: "MISSING"
  });

  assert.deepEqual(
    parseAttendanceLocation("678721 - Spinneys, Mokattam - El Nafora Square"),
    {
      raw: "678721 - Spinneys, Mokattam - El Nafora Square",
      code: "678721",
      name: "Spinneys, Mokattam - El Nafora Square",
      status: "PARSED"
    }
  );

  assert.deepEqual(
    parseAttendanceLocation("515839 - مترو ماركت - الهرم"),
    {
      raw: "515839 - مترو ماركت - الهرم",
      code: "515839",
      name: "مترو ماركت - الهرم",
      status: "PARSED"
    }
  );
}

void main();
