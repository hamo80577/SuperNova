import { Injectable } from "@nestjs/common";

import type { AttendanceLocationParseResult } from "./attendance.types";

@Injectable()
export class AttendanceLocationMapperService {
  parseLocation(rawLocation: string | null | undefined): AttendanceLocationParseResult {
    const displayValue = rawLocation?.trim() ?? "";

    if (!displayValue) {
      return {
        vendorExternalId: null,
        displayName: null,
        outcome: "UNMAPPED_LOCATION_CODE"
      };
    }

    const match = displayValue.match(/^(\d+)\s+-\s*(.+)$/);

    if (!match) {
      return {
        vendorExternalId: null,
        displayName: displayValue,
        outcome: "UNMAPPED_LOCATION_CODE"
      };
    }

    return {
      vendorExternalId: match[1].trim(),
      displayName: match[2].trim() || null,
      outcome: "MAPPED_LOCATION_CODE"
    };
  }
}
