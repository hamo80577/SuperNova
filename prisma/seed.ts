import { AccountStatus, EmploymentStatus, PrismaClient, ProfileStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

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
