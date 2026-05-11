import {
  AccountStatus,
  ChainStatus,
  EmploymentStatus,
  PrismaClient,
  ProfileStatus,
  UserRole,
  VendorStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const BRANCH_DATA_PATH = path.join(process.cwd(), "prisma", "data", "branches.csv");

async function main() {
  const phoneNumber = process.env.SEED_ADMIN_PHONE?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nameEn = process.env.SEED_ADMIN_NAME?.trim() || "SuperNova Admin";

  if (!phoneNumber || !password) {
    console.log("Skipping admin seed: SEED_ADMIN_PHONE or SEED_ADMIN_PASSWORD is not set.");
  } else if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  } else {
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

  await removeLocalDemoData();
  await seedBranchData();
}

async function removeLocalDemoData() {
  const demoChains = await prisma.chain.findMany({
    where: {
      OR: [
        { chainCode: { contains: "DEMO", mode: "insensitive" } },
        { chainName: { contains: "Demo", mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
  const demoVendors = await prisma.vendor.findMany({
    where: {
      OR: [
        { vendorCode: { contains: "DEMO", mode: "insensitive" } },
        { vendorName: { contains: "Demo", mode: "insensitive" } }
      ]
    },
    select: { id: true }
  });
  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { nameEn: { contains: "Demo", mode: "insensitive" } },
        {
          phoneNumber: {
            in: ["+10000000011", "+10000000012", "+10000000013", "+10000000014"]
          }
        }
      ]
    },
    select: { id: true }
  });

  const demoChainIds = demoChains.map((chain) => chain.id);
  const demoVendorIds = demoVendors.map((vendor) => vendor.id);
  const demoUserIds = demoUsers.map((user) => user.id);

  if (!demoChainIds.length && !demoVendorIds.length && !demoUserIds.length) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const demoRequests = await tx.request.findMany({
      where: {
        OR: [
          { createdById: { in: demoUserIds } },
          { targetUserId: { in: demoUserIds } },
          { sourceChainId: { in: demoChainIds } },
          { destinationChainId: { in: demoChainIds } },
          { sourceVendorId: { in: demoVendorIds } },
          { destinationVendorId: { in: demoVendorIds } }
        ]
      },
      select: { id: true }
    });
    const demoRequestIds = demoRequests.map((request) => request.id);

    await tx.request.deleteMany({ where: { id: { in: demoRequestIds } } });
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorUserId: { in: demoUserIds } },
          {
            entityId: {
              in: [
                ...demoUserIds,
                ...demoChainIds,
                ...demoVendorIds,
                ...demoRequestIds
              ]
            }
          }
        ]
      }
    });
    await tx.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
    await tx.pickerBranchAssignment.deleteMany({
      where: {
        OR: [{ pickerId: { in: demoUserIds } }, { vendorId: { in: demoVendorIds } }]
      }
    });
    await tx.vendorChampAssignment.deleteMany({
      where: {
        OR: [{ champId: { in: demoUserIds } }, { vendorId: { in: demoVendorIds } }]
      }
    });
    await tx.chainAreaManagerAssignment.deleteMany({
      where: {
        OR: [{ areaManagerId: { in: demoUserIds } }, { chainId: { in: demoChainIds } }]
      }
    });
    await tx.vendor.deleteMany({ where: { id: { in: demoVendorIds } } });
    await tx.chain.deleteMany({ where: { id: { in: demoChainIds } } });
    await tx.user.deleteMany({ where: { id: { in: demoUserIds } } });
  });

  console.log("Removed local demo users, Chain, Branch, assignments, requests, and notifications.");
}

async function seedBranchData() {
  const file = await readFile(BRANCH_DATA_PATH, "utf8");
  const records = parseBranchCsv(file);
  const chains = new Map<string, string>();

  for (const record of records) {
    chains.set(record.chainCode, record.chainName);
  }

  for (const [chainCode, chainName] of chains) {
    await prisma.chain.upsert({
      where: { chainCode },
      update: { chainName, status: ChainStatus.ACTIVE },
      create: { chainCode, chainName, status: ChainStatus.ACTIVE }
    });
  }

  const persistedChains = await prisma.chain.findMany({
    where: { chainCode: { in: [...chains.keys()] } },
    select: { id: true, chainCode: true }
  });
  const chainIdsByCode = new Map(
    persistedChains.map((chain) => [chain.chainCode, chain.id])
  );

  for (const record of records) {
    const chainId = chainIdsByCode.get(record.chainCode);

    if (!chainId) {
      throw new Error(`Missing Chain for code ${record.chainCode}.`);
    }

    await prisma.vendor.upsert({
      where: { vendorCode: record.branchCode },
      update: {
        vendorName: record.branchName,
        vendorExternalId: null,
        status: VendorStatus.ACTIVE,
        chainId,
        area: null,
        city: null
      },
      create: {
        vendorName: record.branchName,
        vendorCode: record.branchCode,
        vendorExternalId: null,
        status: VendorStatus.ACTIVE,
        chainId,
        area: null,
        city: null
      }
    });
  }

  console.log(
    `Seeded real organization branch data: ${chains.size} Chains and ${records.length} Branches.`
  );
}

function parseBranchCsv(content: string) {
  const rows = parseCsv(content.trim());
  const [header, ...dataRows] = rows;
  const headerIndex = new Map(header.map((column, index) => [column.trim(), index]));

  return dataRows.map((row, index) => {
    const record = {
      chainName: getCsvValue(row, headerIndex, "chain name"),
      chainCode: getCsvValue(row, headerIndex, "chain id"),
      branchCode: getCsvValue(row, headerIndex, "Branch code"),
      branchName: getCsvValue(row, headerIndex, "Branch name")
    };

    if (
      !record.chainName ||
      !record.chainCode ||
      !record.branchCode ||
      !record.branchName
    ) {
      throw new Error(`Invalid branch CSV row ${index + 2}.`);
    }

    return record;
  });
}

function getCsvValue(
  row: string[],
  headerIndex: Map<string, number>,
  column: string
) {
  const index = headerIndex.get(column);

  if (index === undefined) {
    throw new Error(`Missing required CSV column: ${column}.`);
  }

  return row[index]?.trim() ?? "";
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === "\"" && inQuotes && nextChar === "\"") {
      value += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);

  return rows.filter((csvRow) => csvRow.some((cell) => cell.trim()));
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
