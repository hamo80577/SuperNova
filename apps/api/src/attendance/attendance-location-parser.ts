export type AttendanceLocationParseStatus = "PARSED" | "MISSING" | "NO_CODE";

export interface ParsedAttendanceLocation {
  raw: string | null;
  code: string | null;
  name: string | null;
  status: AttendanceLocationParseStatus;
}

export function parseAttendanceLocation(
  value: string | null | undefined
): ParsedAttendanceLocation {
  const raw = normalizeRawLocation(value);

  if (!raw) {
    return {
      raw: null,
      code: null,
      name: null,
      status: "MISSING"
    };
  }

  const match = /^(\d+)\s*-\s*(.*)$/.exec(raw);

  if (!match) {
    return {
      raw,
      code: null,
      name: raw,
      status: "NO_CODE"
    };
  }

  return {
    raw,
    code: match[1] ?? null,
    name: cleanText(match[2] ?? null),
    status: "PARSED"
  };
}

function normalizeRawLocation(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function cleanText(value: string | null) {
  const text = value?.trim();
  return text ? text : null;
}
