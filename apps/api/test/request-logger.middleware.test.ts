import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createRequestLoggerMiddleware,
  formatRequestLogLine,
  isRequestLoggerEnabled
} from "../src/common/middleware/request-logger.middleware";

assert.equal(isRequestLoggerEnabled({ nodeEnv: "development" }), true);
assert.equal(isRequestLoggerEnabled({ nodeEnv: "test" }), true);
assert.equal(isRequestLoggerEnabled({ nodeEnv: undefined }), true);
assert.equal(isRequestLoggerEnabled({ nodeEnv: "production" }), false);
assert.equal(
  isRequestLoggerEnabled({ nodeEnv: "production", flag: "true" }),
  true
);
assert.equal(
  isRequestLoggerEnabled({ nodeEnv: "development", flag: "false" }),
  false
);

const formattedLine = formatRequestLogLine({
  durationMs: 12,
  ip: "::1",
  method: "GET",
  path: "/api/auth/login?password=secret&token=abc",
  statusCode: 200,
  timestamp: new Date("2026-05-17T12:22:10.000Z"),
  userAgent: "Mozilla/5.0 Chrome/124.0 Safari/537.36"
});

assert.match(
  formattedLine,
  /^\[API\] 2026-05-17 \d{2}:22:10  GET  \/api\/auth\/login\s+200  12ms/
);
assert.match(formattedLine, /ip=::1/);
assert.match(formattedLine, /ua=Chrome/);
assert.doesNotMatch(formattedLine, /secret|token|password|Mozilla|Safari/);

const response = new EventEmitter() as EventEmitter & { statusCode: number };
response.statusCode = 403;

let capturedLine = "";
const middleware = createRequestLoggerMiddleware({
  logger: (line) => {
    capturedLine = line;
  },
  now: (() => {
    const dates = [
      new Date("2026-05-17T12:22:20.000Z"),
      new Date("2026-05-17T12:22:20.041Z")
    ];

    return () => dates.shift() ?? new Date("2026-05-17T12:22:20.041Z");
  })()
});

middleware(
  {
    body: { password: "super-secret" },
    headers: {
      authorization: "Bearer token",
      cookie: "supernova_session=secret",
      "user-agent": "curl/8.4.0"
    },
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/approvals/abc/approve?authorization=secret"
  },
  response,
  () => undefined
);
response.emit("finish");

assert.match(
  capturedLine,
  /^\[API\] 2026-05-17 \d{2}:22:20  POST \/api\/approvals\/abc\/approve\s+403  41ms/
);
assert.match(capturedLine, /ip=127\.0\.0\.1/);
assert.match(capturedLine, /ua=curl/);
assert.doesNotMatch(
  capturedLine,
  /super-secret|Bearer|supernova_session|authorization=secret|cookie|password/
);
