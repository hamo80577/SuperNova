import { BadRequestException } from "@nestjs/common";

import { findSensitiveJsonKey } from "../security/sensitive-data.utils";

export function assertRequestPayloadSafe(payload?: Record<string, unknown>) {
  if (!payload) {
    return;
  }

  const sensitiveKey = findSensitiveJsonKey(payload);
  if (sensitiveKey) {
    throw new BadRequestException(
      `Request payload must not contain passwords, secrets, tokens, credentials, or session material. Remove field "${sensitiveKey}".`
    );
  }
}
