export type StructuredEnglishNameFields = Readonly<{
  firstNameEn: string;
  secondNameEn: string;
  thirdNameEn: string;
}>;

export type StructuredEnglishNameField = keyof StructuredEnglishNameFields;

export function buildEnglishNameFromParts(fields: StructuredEnglishNameFields) {
  return [
    fields.firstNameEn.trim(),
    fields.secondNameEn.trim(),
    fields.thirdNameEn.trim()
  ].join(" ");
}

export function getMissingEnglishNamePart(
  fields: StructuredEnglishNameFields
): StructuredEnglishNameField | null {
  if (!fields.firstNameEn.trim()) return "firstNameEn";
  if (!fields.secondNameEn.trim()) return "secondNameEn";
  if (!fields.thirdNameEn.trim()) return "thirdNameEn";
  return null;
}

export function toStructuredEnglishNamePayload(
  fields: StructuredEnglishNameFields
) {
  const firstNameEn = fields.firstNameEn.trim();
  const secondNameEn = fields.secondNameEn.trim();
  const thirdNameEn = fields.thirdNameEn.trim();

  return {
    firstNameEn,
    secondNameEn,
    thirdNameEn,
    nameEn: buildEnglishNameFromParts({ firstNameEn, secondNameEn, thirdNameEn })
  };
}
