type HeaderValue = string | string[] | undefined;

type RequestLike = {
  headers?: Record<string, HeaderValue>;
  ip?: string;
  method?: string;
  originalUrl?: string;
  path?: string;
  socket?: {
    remoteAddress?: string;
  };
  url?: string;
};

type ResponseLike = {
  on(event: "finish", listener: () => void): unknown;
  statusCode?: number;
};

type RequestLoggerMiddleware = (
  request: RequestLike,
  response: ResponseLike,
  next: () => void
) => void;

type RequestLoggerOptions = {
  logger?: (line: string) => void;
  now?: () => Date;
};

type RequestLogLineInput = {
  durationMs: number;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  timestamp: Date;
  userAgent?: HeaderValue;
};

type RequestLoggerEnabledOptions = {
  flag?: string;
  nodeEnv?: string;
};

const PATH_COLUMN_WIDTH = 32;
const MAX_PATH_LENGTH = 120;

export function isRequestLoggerEnabled({
  flag,
  nodeEnv
}: RequestLoggerEnabledOptions = {}) {
  const normalizedFlag = flag?.trim().toLowerCase();

  if (normalizedFlag === "true") {
    return true;
  }

  if (normalizedFlag === "false") {
    return false;
  }

  return nodeEnv !== "production";
}

export function createRequestLoggerMiddleware({
  logger = console.log,
  now = () => new Date()
}: RequestLoggerOptions = {}): RequestLoggerMiddleware {
  return (request, response, next) => {
    const startedAt = now();

    response.on("finish", () => {
      const finishedAt = now();
      const durationMs = Math.max(
        0,
        finishedAt.getTime() - startedAt.getTime()
      );

      logger(
        formatRequestLogLine({
          durationMs,
          ip: getClientIp(request),
          method: request.method,
          path: getRequestPath(request),
          statusCode: response.statusCode,
          timestamp: finishedAt,
          userAgent: getHeader(request.headers, "user-agent")
        })
      );
    });

    next();
  };
}

export function formatRequestLogLine({
  durationMs,
  ip,
  method,
  path,
  statusCode,
  timestamp,
  userAgent
}: RequestLogLineInput) {
  const methodColumn = (method ?? "UNKNOWN").toUpperCase().padEnd(4, " ");
  const pathColumn = sanitizePath(path).padEnd(PATH_COLUMN_WIDTH, " ");
  const statusColumn = String(statusCode ?? 0).padStart(3, " ");
  const durationColumn = `${Math.round(durationMs)}ms`;
  const metadata = formatMetadata(ip, summarizeUserAgent(userAgent));

  return `[API] ${formatTimestamp(
    timestamp
  )}  ${methodColumn} ${pathColumn}  ${statusColumn}  ${durationColumn}${
    metadata ? `  ${metadata}` : ""
  }`;
}

function formatTimestamp(timestamp: Date) {
  const year = timestamp.getFullYear();
  const month = padDatePart(timestamp.getMonth() + 1);
  const day = padDatePart(timestamp.getDate());
  const hours = padDatePart(timestamp.getHours());
  const minutes = padDatePart(timestamp.getMinutes());
  const seconds = padDatePart(timestamp.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getRequestPath(request: RequestLike) {
  return request.originalUrl ?? request.url ?? request.path ?? "/";
}

function sanitizePath(path?: string) {
  const cleanPath = (path ?? "/").split(/[?#]/, 1)[0] || "/";

  if (cleanPath.length <= MAX_PATH_LENGTH) {
    return cleanPath;
  }

  return `${cleanPath.slice(0, MAX_PATH_LENGTH - 1)}...`;
}

function getHeader(
  headers: RequestLike["headers"],
  headerName: string
): HeaderValue {
  if (!headers) {
    return undefined;
  }

  const matchingHeader = Object.keys(headers).find(
    (key) => key.toLowerCase() === headerName
  );

  return matchingHeader ? headers[matchingHeader] : undefined;
}

function summarizeUserAgent(userAgent: HeaderValue) {
  const value = Array.isArray(userAgent) ? userAgent[0] : userAgent;

  if (!value) {
    return undefined;
  }

  const lowerValue = value.toLowerCase();

  if (lowerValue.includes("edg/")) {
    return "Edge";
  }

  if (lowerValue.includes("chrome/")) {
    return "Chrome";
  }

  if (lowerValue.includes("firefox/")) {
    return "Firefox";
  }

  if (lowerValue.includes("safari/")) {
    return "Safari";
  }

  if (lowerValue.includes("postmanruntime/")) {
    return "Postman";
  }

  if (lowerValue.includes("curl/")) {
    return "curl";
  }

  if (lowerValue.includes("node")) {
    return "Node";
  }

  const product = value.split(/\s+/, 1)[0]?.split("/", 1)[0];
  const safeProduct = product?.replace(/[^a-zA-Z0-9._-]/g, "");

  return safeProduct ? safeProduct.slice(0, 24) : undefined;
}

function getClientIp(request: RequestLike) {
  const ip = request.ip ?? request.socket?.remoteAddress;

  if (!ip) {
    return undefined;
  }

  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

function formatMetadata(ip?: string, userAgent?: string) {
  const metadata = [];

  if (ip) {
    metadata.push(`ip=${ip}`);
  }

  if (userAgent) {
    metadata.push(`ua=${userAgent}`);
  }

  return metadata.join(" ");
}
