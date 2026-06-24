export type NewHireEnglishNameInput = Readonly<{
  firstNameEn?: string;
  secondNameEn?: string;
  thirdNameEn?: string;
  nameEn?: string;
}>;

export type NewHireEnglishNameParts = Readonly<{
  firstNameEn: string;
  secondNameEn: string;
  thirdNameEn: string;
}>;

export type HrSyncEnglishNameParts = Readonly<{
  firstNameEnglish: string;
  secondNameEnglish: string;
  thirdNameEnglish: string;
}>;

export function buildNewHireEnglishName(parts: NewHireEnglishNameParts) {
  return [parts.firstNameEn, parts.secondNameEn, parts.thirdNameEn].join(" ");
}

export function normalizeNewHireEnglishNameParts(
  input: NewHireEnglishNameInput
): (NewHireEnglishNameParts & { nameEn: string }) | null {
  const firstNameEn = input.firstNameEn?.trim();
  const secondNameEn = input.secondNameEn?.trim();
  const thirdNameEn = input.thirdNameEn?.trim();

  if (!firstNameEn || !secondNameEn || !thirdNameEn) {
    return null;
  }

  return {
    firstNameEn,
    secondNameEn,
    thirdNameEn,
    nameEn: buildNewHireEnglishName({ firstNameEn, secondNameEn, thirdNameEn })
  };
}

export function toHrSyncEnglishNameParts(
  input: NewHireEnglishNameInput,
  fallbackName: string
): HrSyncEnglishNameParts {
  const structured = normalizeNewHireEnglishNameParts(input);
  if (structured) {
    return {
      firstNameEnglish: structured.firstNameEn,
      secondNameEnglish: structured.secondNameEn,
      thirdNameEnglish: structured.thirdNameEn
    };
  }

  const nameParts = (input.nameEn?.trim() || fallbackName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstNameEnglish: nameParts[0] ?? fallbackName,
    secondNameEnglish: nameParts[1] ?? "",
    thirdNameEnglish: nameParts.slice(2).join(" ")
  };
}
