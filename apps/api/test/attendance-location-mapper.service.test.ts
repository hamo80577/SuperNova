import assert from "node:assert/strict";

import { AttendanceLocationMapperService } from "../src/attendance/attendance-location-mapper.service";

const service = new AttendanceLocationMapperService();

assert.deepEqual(
  service.parseLocation("740921 - Carrefour, Zahraa El Maadi - El Me'arag El Ouloy"),
  {
    vendorExternalId: "740921",
    displayName: "Carrefour, Zahraa El Maadi - El Me'arag El Ouloy",
    outcome: "MAPPED_LOCATION_CODE"
  }
);

assert.deepEqual(service.parseLocation("  612846  -  LuLu Hypermarket, Tagammoa 1 "), {
  vendorExternalId: "612846",
  displayName: "LuLu Hypermarket, Tagammoa 1",
  outcome: "MAPPED_LOCATION_CODE"
});

assert.deepEqual(service.parseLocation("All Vendors"), {
  vendorExternalId: null,
  displayName: "All Vendors",
  outcome: "UNMAPPED_LOCATION_CODE"
});

assert.deepEqual(service.parseLocation(""), {
  vendorExternalId: null,
  displayName: null,
  outcome: "UNMAPPED_LOCATION_CODE"
});
