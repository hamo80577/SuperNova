import assert from "node:assert/strict";

import {
  buildEnglishNameFromParts,
  getMissingEnglishNamePart,
  toStructuredEnglishNamePayload
} from "./new-hire-name-fields";

assert.equal(
  buildEnglishNameFromParts({
    firstNameEn: "  Picker ",
    secondNameEn: " Middle ",
    thirdNameEn: " One "
  }),
  "Picker Middle One"
);

assert.equal(
  getMissingEnglishNamePart({
    firstNameEn: "Picker",
    secondNameEn: "",
    thirdNameEn: "One"
  }),
  "secondNameEn"
);

assert.deepEqual(
  toStructuredEnglishNamePayload({
    firstNameEn: " Picker ",
    secondNameEn: " Middle ",
    thirdNameEn: " One "
  }),
  {
    firstNameEn: "Picker",
    secondNameEn: "Middle",
    thirdNameEn: "One",
    nameEn: "Picker Middle One"
  }
);
