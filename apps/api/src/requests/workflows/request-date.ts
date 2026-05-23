import { BadRequestException } from "@nestjs/common";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeRequiredDateOnly(
  value: string | null | undefined,
  fieldName: string,
  requiredMessage: string
) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new BadRequestException(requiredMessage);
  }

  if (!dateOnlyPattern.test(normalized)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return normalized;
}

export function normalizeOptionalDateOnly(
  value: string | null | undefined,
  fieldName: string
) {
  if (!value?.trim()) {
    return undefined;
  }

  return normalizeRequiredDateOnly(
    value,
    fieldName,
    `${fieldName} is required.`
  );
}
