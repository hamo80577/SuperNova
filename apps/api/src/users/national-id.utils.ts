export function maskNationalId(nationalId: string) {
  const trimmed = nationalId.trim();

  if (trimmed.length <= 4) {
    return "*".repeat(trimmed.length);
  }

  return `${"*".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
