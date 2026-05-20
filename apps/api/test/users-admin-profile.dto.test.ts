import assert from "node:assert/strict";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateAdminProfileDto } from "../src/users/dto/admin-profile.dto";

async function run() {
  const dto = plainToInstance(UpdateAdminProfileDto, {
    nameEn: "BIM Area Manager",
    dateOfBirth: "",
    joiningDate: "2026-05-01"
  });

  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true
  });

  assert.equal(errors.length, 0);
  assert.equal(dto.dateOfBirth, undefined);
  assert.equal(dto.joiningDate, "2026-05-01");

  const invalid = plainToInstance(UpdateAdminProfileDto, {
    dateOfBirth: "not-a-date"
  });
  const invalidErrors = await validate(invalid);

  assert.equal(invalidErrors.length, 1);
}

void run();
