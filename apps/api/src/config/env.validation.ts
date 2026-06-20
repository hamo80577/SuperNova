const MIN_SECRET_LENGTH = 32;

type EnvironmentConfig = Record<string, unknown>;

export function validateEnvironment(config: EnvironmentConfig) {
  const errors: string[] = [];

  const databaseUrl = readRequiredString(config, "DATABASE_URL", errors);
  const jwtSecret = readRequiredString(config, "JWT_SECRET", errors);
  const authCookieName = readRequiredString(config, "AUTH_COOKIE_NAME", errors);
  const webOrigin = readRequiredString(config, "WEB_ORIGIN", errors);
  const nodeEnv = readOptionalString(config, "NODE_ENV") ?? "development";
  const apiPort = readOptionalString(config, "API_PORT") ?? "4000";
  const jwtExpiresIn = readOptionalString(config, "JWT_EXPIRES_IN") ?? "8h";
  const temporaryPasswordEncryptionKey = readOptionalString(
    config,
    "TEMP_PASSWORD_ENCRYPTION_KEY"
  );
  const hrSyncEnabled = readBooleanString(config, "HR_SYNC_ENABLED", errors);
  const hrSyncWebAppUrl = readOptionalString(config, "HR_SYNC_WEB_APP_URL");
  const hrSyncSecret = readOptionalString(config, "HR_SYNC_SECRET");
  const redisUrl =
    readOptionalString(config, "REDIS_URL") ?? "redis://localhost:6379";
  const importMaxFileSizeBytes =
    readOptionalString(config, "IMPORT_MAX_FILE_SIZE_BYTES") ?? "104857600";

  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  if (!/^\d+$/.test(apiPort)) {
    errors.push("API_PORT must be a number.");
  }

  if (!isValidRedisUrl(redisUrl)) {
    errors.push("REDIS_URL must be a valid redis:// or rediss:// URL.");
  }

  if (
    !/^\d+$/.test(importMaxFileSizeBytes) ||
    Number(importMaxFileSizeBytes) <= 0
  ) {
    errors.push("IMPORT_MAX_FILE_SIZE_BYTES must be a positive integer.");
  }

  const normalizedWebOrigin = normalizeOrigin(webOrigin);
  if (webOrigin && !normalizedWebOrigin) {
    errors.push("WEB_ORIGIN must be a valid origin.");
  }

  if (temporaryPasswordEncryptionKey) {
    if (temporaryPasswordEncryptionKey.length < MIN_SECRET_LENGTH) {
      errors.push(
        `TEMP_PASSWORD_ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters.`
      );
    }
  } else if (nodeEnv === "production") {
    errors.push(
      "TEMP_PASSWORD_ENCRYPTION_KEY must be explicitly set in production."
    );
  }

  if (hrSyncEnabled) {
    if (!hrSyncWebAppUrl) {
      errors.push("HR_SYNC_WEB_APP_URL is required when HR_SYNC_ENABLED=true.");
    } else if (!isValidHttpsUrl(hrSyncWebAppUrl)) {
      errors.push("HR_SYNC_WEB_APP_URL must be a valid HTTPS URL.");
    }

    if (!hrSyncSecret) {
      errors.push("HR_SYNC_SECRET is required when HR_SYNC_ENABLED=true.");
    } else if (hrSyncSecret.length < MIN_SECRET_LENGTH) {
      errors.push(
        `HR_SYNC_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`API environment validation failed: ${errors.join(" ")}`);
  }

  return {
    ...config,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    AUTH_COOKIE_NAME: authCookieName,
    WEB_ORIGIN: normalizedWebOrigin,
    NODE_ENV: nodeEnv,
    API_PORT: apiPort,
    JWT_EXPIRES_IN: jwtExpiresIn,
    REDIS_URL: redisUrl,
    IMPORT_MAX_FILE_SIZE_BYTES: importMaxFileSizeBytes,
    HR_SYNC_ENABLED: hrSyncEnabled ? "true" : "false",
    ...(hrSyncWebAppUrl ? { HR_SYNC_WEB_APP_URL: hrSyncWebAppUrl } : {}),
    ...(hrSyncSecret ? { HR_SYNC_SECRET: hrSyncSecret } : {}),
    ...(temporaryPasswordEncryptionKey
      ? { TEMP_PASSWORD_ENCRYPTION_KEY: temporaryPasswordEncryptionKey }
      : {})
  };
}

function readRequiredString(
  config: EnvironmentConfig,
  key: string,
  errors: string[]
) {
  const value = readOptionalString(config, key);

  if (!value) {
    errors.push(`${key} is required.`);
  }

  return value;
}

function readOptionalString(config: EnvironmentConfig, key: string) {
  const value = config[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBooleanString(
  config: EnvironmentConfig,
  key: string,
  errors: string[]
) {
  const value = readOptionalString(config, key);

  if (!value) {
    return false;
  }

  if (value !== "true" && value !== "false") {
    errors.push(`${key} must be true or false.`);
    return false;
  }

  return value === "true";
}

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const isHttpOrigin = url.protocol === "http:" || url.protocol === "https:";
    const hasNoPathOrQuery =
      url.pathname === "/" && url.search === "" && url.hash === "";

    return isHttpOrigin && hasNoPathOrQuery ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function isValidHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidRedisUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "redis:" || url.protocol === "rediss:";
  } catch {
    return false;
  }
}
