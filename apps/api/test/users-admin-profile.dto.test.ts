import assert from "node:assert/strict";

import {
  AccountStatus,
  BlockStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateAdminProfileDto } from "../src/users/dto/admin-profile.dto";
import { UsersService } from "../src/users/users.service";

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

  // Invalid joiningDate is rejected by validation.
  const invalidJoining = plainToInstance(UpdateAdminProfileDto, {
    joiningDate: "not-a-date"
  });
  const invalidJoiningErrors = await validate(invalidJoining);
  assert.equal(invalidJoiningErrors.length, 1);

  // Admin profile update still writes joiningDate to the user.
  let captured: Record<string, unknown> | null = null;
  const existing = {
    id: "user-1",
    role: UserRole.PICKER,
    nameEn: "Existing",
    nameAr: null,
    phoneNumber: "01000000000",
    nationalId: "12345678901234",
    address: null,
    dateOfBirth: null,
    gender: Gender.UNSPECIFIED,
    shopperId: null,
    ibsId: null,
    uiTheme: "ORANGE",
    joiningDate: new Date("2024-01-01T00:00:00.000Z"),
    accountStatus: AccountStatus.ACTIVE,
    employmentStatus: EmploymentStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    passwordHash: "x",
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z")
  };
  const service = new UsersService(
    { log: async () => ({}) } as never,
    {
      user: {
        findUnique: async () => existing,
        update: async (args: { data: Record<string, unknown> }) => {
          captured = args.data;
          return { ...existing, ...args.data };
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  await service.updateAdminProfile(
    "user-1",
    { joiningDate: "2026-05-01" } as never,
    { id: "admin-1", role: UserRole.ADMIN } as never,
    {}
  );

  assert.ok(captured);
  assert.ok((captured as { joiningDate?: unknown }).joiningDate instanceof Date);
  assert.equal(
    ((captured as { joiningDate: Date }).joiningDate).toISOString(),
    "2026-05-01T00:00:00.000Z"
  );
}

void run();
