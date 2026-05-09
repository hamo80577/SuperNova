const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "credential",
  "jwt",
  "password",
  "secret",
  "session",
  "token"
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

export function findSensitiveJsonKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findSensitiveJsonKey(item);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      return key;
    }

    const nestedKey = findSensitiveJsonKey(nested);
    if (nestedKey) {
      return nestedKey;
    }
  }

  return null;
}

export function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]): [string, unknown] => [
      key,
      isSensitiveKey(key) ? "[REDACTED]" : redactJson(nested)
    ])
  );
}
