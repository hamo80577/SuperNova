var SERVICE_NAME = "supernova-hr-sync";
var PROPERTY_SPREADSHEET_ID = "SPREADSHEET_ID";
var PROPERTY_HR_SYNC_SECRET = "HR_SYNC_SECRET";

var NEW_HIRE_SHEET_NAME = "New Hire";
var RESIGN_SHEET_NAME = "Resign";

var NEW_HIRE_HEADERS = [
  "Email Address",
  "Request Type",
  "New Hire Full Name (English)",
  "New Hire National ID",
  "New Hire Phone Number",
  "New Hire Actual Joining/Hiring Date",
  "New Hire Home Address",
  "Vertical",
  "New Hire Title"
];

var RESIGN_HEADERS = [
  "Email Address",
  "Request Type",
  "Type",
  "Resigned Employee Name",
  "Resigned Employee National ID",
  "Resigned Employee Last Working Date (LWD)",
  "Resigned Employee Title"
];

var NEW_HIRE_REQUIRED_FIELDS = [
  "finalizerDisplayName",
  "requestType",
  "fullNameEnglish",
  "nationalId",
  "phoneNumber",
  "actualJoiningDate",
  "homeAddress",
  "vertical",
  "title"
];

var RESIGN_REQUIRED_FIELDS = [
  "finalizerDisplayName",
  "requestType",
  "type",
  "employeeName",
  "nationalId",
  "lastWorkingDate",
  "title"
];

var ALLOWED_RESIGN_TYPES = ["No Block", "Temporary Block", "Permanent Block"];

function doGet(e) {
  var properties = PropertiesService.getScriptProperties();
  var configured = Boolean(
    properties.getProperty(PROPERTY_SPREADSHEET_ID) &&
      properties.getProperty(PROPERTY_HR_SYNC_SECRET)
  );

  return jsonResponse({
    ok: true,
    service: SERVICE_NAME,
    configured: configured,
    message: configured
      ? "HR Sync Apps Script is configured."
      : "HR Sync Apps Script is not configured."
  });
}

function doPost(e) {
  var syncId = generateSyncId();

  try {
    var body = parseJsonBody(e);
    validateSecret(body);

    if (!body.eventType || typeof body.eventType !== "string") {
      throw new Error("eventType is required.");
    }

    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
      throw new Error("payload must be an object.");
    }

    if (
      body.eventType !== "NEW_HIRE" &&
      body.eventType !== "REHIRE" &&
      body.eventType !== "RESIGN"
    ) {
      return jsonResponse({
        ok: false,
        syncId: syncId,
        error: "Unsupported eventType."
      });
    }

    ensureSpreadsheet();
    ensureSheet(NEW_HIRE_SHEET_NAME, NEW_HIRE_HEADERS);
    ensureSheet(RESIGN_SHEET_NAME, RESIGN_HEADERS);

    var appendResult;
    if (body.eventType === "NEW_HIRE" || body.eventType === "REHIRE") {
      appendResult = appendNewHireRow(body.eventType, body.payload);
    } else {
      appendResult = appendResignRow(body.payload);
    }

    return jsonResponse({
      ok: true,
      syncId: syncId,
      sheet: appendResult.sheet,
      rowNumber: appendResult.rowNumber,
      message: "Row appended successfully"
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      syncId: syncId,
      error: error instanceof Error ? error.message : "HR sync failed."
    });
  }
}

function setupHrSync(spreadsheetUrlOrId, sharedSecret) {
  if (!spreadsheetUrlOrId || String(spreadsheetUrlOrId).trim() === "") {
    throw new Error("spreadsheetUrlOrId is required.");
  }

  if (!sharedSecret || String(sharedSecret).trim() === "") {
    throw new Error("sharedSecret is required.");
  }

  var normalizedSecret = String(sharedSecret).trim();
  if (normalizedSecret.length < 32) {
    throw new Error("sharedSecret must be at least 32 characters.");
  }

  var spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(PROPERTY_SPREADSHEET_ID, spreadsheetId);
  properties.setProperty(PROPERTY_HR_SYNC_SECRET, normalizedSecret);

  ensureSpreadsheet();
  ensureSheet(NEW_HIRE_SHEET_NAME, NEW_HIRE_HEADERS);
  ensureSheet(RESIGN_SHEET_NAME, RESIGN_HEADERS);

  return {
    ok: true,
    service: SERVICE_NAME,
    configured: true,
    sheets: [NEW_HIRE_SHEET_NAME, RESIGN_SHEET_NAME],
    message: "HR Sync setup complete."
  };
}

function getRequiredProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || String(value).trim() === "") {
    throw new Error("Missing Script Property: " + name + ".");
  }

  return String(value).trim();
}

function extractSpreadsheetId(spreadsheetUrlOrId) {
  var value = String(spreadsheetUrlOrId).trim();

  var pathMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  var queryMatch = value.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  if (/^[a-zA-Z0-9-_]+$/.test(value)) {
    return value;
  }

  throw new Error("Invalid spreadsheet URL or ID.");
}

function parseJsonBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing JSON body.");
  }

  try {
    var parsed = JSON.parse(e.postData.contents);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON body must be an object.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Bad JSON.");
    }

    throw error;
  }
}

function validateSecret(payload) {
  var expectedSecret = getRequiredProperty(PROPERTY_HR_SYNC_SECRET);
  if (!payload || typeof payload.secret !== "string" || payload.secret !== expectedSecret) {
    throw new Error("Invalid secret.");
  }
}

function ensureSpreadsheet() {
  var spreadsheetId = getRequiredProperty(PROPERTY_SPREADSHEET_ID);
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet(name, headers) {
  var spreadsheet = ensureSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  var firstRowValues = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
    .getValues()[0]
    .map(function (value) {
      return String(value).trim();
    });

  var rowIsEmpty = firstRowValues.every(function (value) {
    return value === "";
  });

  if (rowIsEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  var headersMatch =
    firstRowValues.length === headers.length &&
    headers.every(function (header, index) {
      return firstRowValues[index] === header;
    });

  if (!headersMatch) {
    throw new Error(
      "Header mismatch for sheet " + name + ". Expected: " + headers.join(", ")
    );
  }

  return sheet;
}

function appendNewHireRow(eventType, payload) {
  validateRequiredFields(payload, NEW_HIRE_REQUIRED_FIELDS);

  if (eventType === "NEW_HIRE" && payload.requestType !== "New Hire") {
    throw new Error('NEW_HIRE payload.requestType must be "New Hire".');
  }

  if (eventType === "REHIRE" && payload.requestType !== "Rehire") {
    throw new Error('REHIRE payload.requestType must be "Rehire".');
  }

  if (payload.vertical !== "Local Shops") {
    throw new Error('payload.vertical must be "Local Shops".');
  }

  if (payload.title !== "Picker") {
    throw new Error('payload.title must be "Picker".');
  }

  var sheet = ensureSheet(NEW_HIRE_SHEET_NAME, NEW_HIRE_HEADERS);
  sheet.appendRow([
    trimString(payload.finalizerDisplayName),
    trimString(payload.requestType),
    trimString(payload.fullNameEnglish),
    trimString(payload.nationalId),
    trimString(payload.phoneNumber),
    trimString(payload.actualJoiningDate),
    trimString(payload.homeAddress),
    trimString(payload.vertical),
    trimString(payload.title)
  ]);

  return {
    sheet: NEW_HIRE_SHEET_NAME,
    rowNumber: sheet.getLastRow()
  };
}

function appendResignRow(payload) {
  validateRequiredFields(payload, RESIGN_REQUIRED_FIELDS);

  if (payload.requestType !== "Resign") {
    throw new Error('payload.requestType must be "Resign".');
  }

  if (payload.title !== "Picker") {
    throw new Error('payload.title must be "Picker".');
  }

  if (ALLOWED_RESIGN_TYPES.indexOf(payload.type) === -1) {
    throw new Error(
      "payload.type must be one of: " + ALLOWED_RESIGN_TYPES.join(", ") + "."
    );
  }

  var sheet = ensureSheet(RESIGN_SHEET_NAME, RESIGN_HEADERS);
  sheet.appendRow([
    trimString(payload.finalizerDisplayName),
    trimString(payload.requestType),
    trimString(payload.type),
    trimString(payload.employeeName),
    trimString(payload.nationalId),
    trimString(payload.lastWorkingDate),
    trimString(payload.title)
  ]);

  return {
    sheet: RESIGN_SHEET_NAME,
    rowNumber: sheet.getLastRow()
  };
}

function validateRequiredFields(payload, requiredFields) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload must be an object.");
  }

  requiredFields.forEach(function (field) {
    if (typeof payload[field] !== "string" || payload[field].trim() === "") {
      throw new Error("Missing required payload field: " + field + ".");
    }
  });
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function generateSyncId() {
  return "hrsync-" + Utilities.getUuid();
}

function trimString(value) {
  return String(value).trim();
}
