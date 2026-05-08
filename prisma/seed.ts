import {
  AccountStatus,
  EmploymentStatus,
  PrismaClient,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;

async function main() {
  const phoneNumber = process.env.SEED_ADMIN_PHONE?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nameEn = process.env.SEED_ADMIN_NAME?.trim() || "SuperNova Admin";

  if (!phoneNumber || !password) {
    console.log("Skipping admin seed: SEED_ADMIN_PHONE or SEED_ADMIN_PASSWORD is not set.");
    return;
  }

  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  await prisma.user.upsert({
    where: { phoneNumber },
    update: {
      nameEn,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      employmentStatus: EmploymentStatus.ACTIVE,
      profileStatus: ProfileStatus.COMPLETE,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null
    },
    create: {
      phoneNumber,
      nameEn,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      employmentStatus: EmploymentStatus.ACTIVE,
      profileStatus: ProfileStatus.COMPLETE,
      mustChangePassword: false
    }
  });

  console.log("Seeded local development admin user from environment variables.");

  if (process.env.SEED_DEMO_ASSIGNMENT_USERS === "true") {
    await seedDemoAssignmentUsers();
  }
}

async function seedDemoAssignmentUsers() {
  const demoPasswordHash = await bcrypt.hash(
    process.env.SEED_DEMO_PASSWORD ?? randomUUID(),
    PASSWORD_HASH_ROUNDS
  );

  const demoUsers = [
    {
      phoneNumber: process.env.SEED_DEMO_PICKER_PHONE ?? "+10000000011",
      nameEn: "Local Demo Picker",
      role: UserRole.PICKER
    },
    {
      phoneNumber: process.env.SEED_DEMO_CHAMP_PHONE ?? "+10000000012",
      nameEn: "Local Demo Champ",
      role: UserRole.CHAMP
    },
    {
      phoneNumber: process.env.SEED_DEMO_AREA_MANAGER_PHONE ?? "+10000000013",
      nameEn: "Local Demo Area Manager",
      role: UserRole.AREA_MANAGER
    },
    {
      phoneNumber:
        process.env.SEED_DEMO_OUT_OF_SCOPE_AREA_MANAGER_PHONE ?? "+10000000014",
      nameEn: "Local Demo Out Of Scope Area Manager",
      role: UserRole.AREA_MANAGER
    }
  ];

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { phoneNumber: user.phoneNumber },
      update: {
        nameEn: user.nameEn,
        passwordHash: demoPasswordHash,
        role: user.role,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE,
        profileStatus: ProfileStatus.COMPLETE,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null
      },
      create: {
        phoneNumber: user.phoneNumber,
        nameEn: user.nameEn,
        passwordHash: demoPasswordHash,
        role: user.role,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE,
        profileStatus: ProfileStatus.COMPLETE,
        mustChangePassword: false
      }
    });
  }

  console.log("Seeded local demo assignment users.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
