import "reflect-metadata";

import assert from "node:assert/strict";

import {
  AccountStatus,
  BlockStatus,
  EmploymentStatus,
  Gender,
  ProfileStatus,
  UiTheme,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { AuthService } from "../src/auth/auth.service";

async function run() {
  await testLoginUsesNationalIdOnly();
  await testLoginSafeUserDoesNotExposeFullNationalId();
  await testFailedLoginAuditMasksNationalId();
  console.log("auth national id login tests passed");
}

async function testLoginUsesNationalIdOnly() {
  const user = await buildUser();
  const auditLogs: Array<Record<string, unknown>> = [];
  const service = createService({
    auditLogs,
    user,
    findByPhoneNumber: async () => {
      throw new Error("Phone number lookup must not be used for login.");
    }
  });
  const response = createResponse();

  const result = await service.login(
    {
      nationalId: user.nationalId,
      password: "Password123",
      rememberMe: false
    } as never,
    { response }
  );

  assert.equal(result.user.id, user.id);
  assert.equal(result.user.nationalIdMasked, "**********4123");
  assert.equal(response.cookies.length, 1);
  assert.equal(auditLogs.at(-1)?.action, "LOGIN_SUCCESS");
}

async function testLoginSafeUserDoesNotExposeFullNationalId() {
  const user = await buildUser();
  const auditLogs: Array<Record<string, unknown>> = [];
  const service = createService({ auditLogs, user });

  const result = await service.login(
    {
      nationalId: user.nationalId,
      password: "Password123",
      rememberMe: false
    } as never,
    { response: createResponse() }
  );

  assert.equal("nationalId" in result.user, false);
  assert.equal(result.user.nationalIdMasked, "**********4123");
}

async function testFailedLoginAuditMasksNationalId() {
  const user = await buildUser();
  const auditLogs: Array<Record<string, unknown>> = [];
  const service = createService({ auditLogs, user });

  await assert.rejects(
    () =>
      service.login(
        {
          nationalId: user.nationalId,
          password: "WrongPassword123",
          rememberMe: false
        } as never,
        { response: createResponse() }
      ),
    /Invalid national ID or password/
  );

  const failedLog = auditLogs.at(-1);
  assert.equal(failedLog?.action, "LOGIN_FAILED");
  assert.notDeepEqual(failedLog?.newValue, { nationalId: user.nationalId });
  assert.deepEqual(failedLog?.newValue, {
    nationalId: "**********4123"
  });
}

async function buildUser() {
  return {
    id: "user-1",
    ibsId: null,
    shopperId: null,
    role: UserRole.CHAMP,
    nameEn: "Champ User",
    nameAr: null,
    phoneNumber: "01012345678",
    nationalId: "29801011234123",
    address: "Cairo",
    dateOfBirth: new Date("1998-01-01T00:00:00.000Z"),
    gender: Gender.UNSPECIFIED,
    uiTheme: UiTheme.ORANGE,
    joiningDate: new Date("2025-01-01T00:00:00.000Z"),
    employmentStatus: EmploymentStatus.ACTIVE,
    resignationDate: null,
    accountStatus: AccountStatus.ACTIVE,
    profileStatus: ProfileStatus.COMPLETE,
    blockStatus: BlockStatus.NO_BLOCK,
    blockedUntil: null,
    blockReason: null,
    passwordHash: await bcrypt.hash("Password123", 4),
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    temporaryPasswordCiphertext: null,
    temporaryPasswordCreatedAt: null,
    lastLoginAt: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z")
  };
}

function createService({
  auditLogs,
  findByPhoneNumber,
  user
}: {
  auditLogs: Array<Record<string, unknown>>;
  findByPhoneNumber?: (phoneNumber: string) => Promise<unknown>;
  user: Awaited<ReturnType<typeof buildUser>>;
}) {
  return new AuthService(
    {
      log: async (entry: Record<string, unknown>) => {
        auditLogs.push(entry);
        return entry;
      }
    } as never,
    {
      get: (key: string) => key === "auth.isProduction" ? false : undefined,
      getOrThrow: (key: string) => {
        const values: Record<string, string> = {
          "auth.cookieName": "supernova_session",
          "auth.jwtExpiresIn": "1h",
          "auth.jwtSecret": "test-secret",
          "auth.rememberMeJwtExpiresIn": "30d"
        };
        return values[key];
      }
    } as never,
    {
      signAsync: async () => "signed-token"
    } as never,
    {
      user: {
        update: async () => ({
          ...user,
          lastLoginAt: new Date("2026-06-17T10:00:00.000Z")
        })
      }
    } as never,
    {
      findByNationalId: async (nationalId: string) =>
        nationalId === user.nationalId ? user : null,
      findByPhoneNumber:
        findByPhoneNumber ??
        (async () => {
          throw new Error("Phone number lookup must not be used for login.");
        }),
      findById: async () => user
    } as never
  );
}

function createResponse() {
  return {
    cookies: [] as Array<{ name: string; value: string }>,
    clearCookie() {},
    cookie(name: string, value: string) {
      this.cookies.push({ name, value });
    }
  } as never;
}

void run();
