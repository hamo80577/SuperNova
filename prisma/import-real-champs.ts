import "dotenv/config";

import {
  AccountStatus,
  AssignmentStatus,
  EmploymentStatus,
  Gender,
  Prisma,
  PrismaClient,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  createCipheriv,
  createHash,
  randomBytes
} from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const TEMPORARY_PASSWORD_EXPIRY_HOURS = 72;
const REPORT_DIR = "C:\\Users\\MohammedMahmoud\\Desktop\\SuperNova-import-reports";

type CsvRow = {
  sourceLine: number;
  nameEn: string;
  nameAr: string | null;
  phoneNumber: string;
  role: string;
  nationalId: string;
  gender: Gender;
  dateOfBirth: Date | null;
  address: string | null;
  joiningDate: Date | null;
  shopperId: string | null;
  ibsId: string | null;
  vendorCode: string | null;
  isActive: boolean;
  resignationDate: Date | null;
};

type CanonicalChamp = CsvRow & {
  duplicateSourceLines: number[];
};

type PreparedActiveChamp = CanonicalChamp & {
  temporaryPassword: string;
  passwordHash: string;
  temporaryPasswordCiphertext: string;
  temporaryPasswordExpiresAt: Date;
};

type ImportOptions = {
  dryRun: boolean;
  filePath: string;
};

async function main() {
  const options = getOptions(process.argv.slice(2));
  const parsed = await parseChampCsv(options.filePath);
  const deduped = dedupeRows(parsed.validRows);
  const vendorCodes = [
    ...new Set(
      deduped.canonicalRows
        .filter((row) => row.isActive)
        .map((row) => row.vendorCode)
        .filter((value): value is string => Boolean(value))
    )
  ];

  const vendors = await prisma.vendor.findMany({
    where: { vendorCode: { in: vendorCodes } },
    select: { id: true, vendorCode: true, vendorName: true, chainId: true }
  });
  const vendorByCode = new Map(vendors.map((vendor) => [vendor.vendorCode, vendor]));
  const unmatchedVendorCodes = vendorCodes.filter((code) => !vendorByCode.has(code));
  if (unmatchedVendorCodes.length) {
    throw new Error(
      `Import blocked. Missing Branch vendorCode values: ${unmatchedVendorCodes.join(", ")}`
    );
  }

  await assertNoNonChampUniqueConflicts(deduped.canonicalRows);

  const activeRows = deduped.canonicalRows.filter((row) => row.isActive);
  const inactiveRows = deduped.canonicalRows.filter((row) => !row.isActive);
  const activeWithoutBranch = activeRows.filter((row) => !row.vendorCode);

  if (activeWithoutBranch.length) {
    throw new Error(
      `Import blocked. Active rows without vendorCode: ${activeWithoutBranch
        .map((row) => row.sourceLine)
        .join(", ")}`
    );
  }

  const summary = {
    rawRows: parsed.rawRows,
    validRows: parsed.validRows.length,
    skippedBlankIdentityRows: parsed.skippedBlankIdentityRows,
    skippedInvalidNationalId: parsed.skippedInvalidNationalId,
    canonicalRows: deduped.canonicalRows.length,
    duplicateRowsRemoved: deduped.duplicateRowsRemoved,
    duplicateGroups: deduped.duplicateGroups,
    activeChamps: activeRows.length,
    inactiveChamps: inactiveRows.length,
    activeVendorCodes: vendorCodes.length,
    matchedVendorCodes: vendors.length
  };

  printSummary(summary, options.dryRun);

  if (options.dryRun) {
    return;
  }

  const importedAt = new Date();
  const inactivePasswordHash = await bcrypt.hash(
    `DISABLED-${randomBytes(24).toString("base64url")}`,
    PASSWORD_HASH_ROUNDS
  );
  const preparedActiveRows: PreparedActiveChamp[] = [];

  for (const row of activeRows) {
    const temporaryPassword = generateTemporaryPassword();
    preparedActiveRows.push({
      ...row,
      temporaryPassword,
      passwordHash: await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS),
      temporaryPasswordCiphertext: encryptTemporaryPassword(temporaryPassword),
      temporaryPasswordExpiresAt: new Date(
        importedAt.getTime() + TEMPORARY_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000
      )
    });
  }

  const reportPath = await writeImportReport(preparedActiveRows, vendorByCode, importedAt);

  await prisma.$transaction(
    async (tx) => {
      await deleteExistingChampData(tx);

      for (const row of preparedActiveRows) {
        const vendor = vendorByCode.get(row.vendorCode ?? "");
        if (!vendor) {
          throw new Error(`Missing Branch for vendorCode ${row.vendorCode}.`);
        }

        const champ = await tx.user.create({
          data: {
            role: UserRole.CHAMP,
            nameEn: row.nameEn,
            nameAr: row.nameAr,
            phoneNumber: row.phoneNumber,
            nationalId: row.nationalId,
            address: row.address,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender,
            joiningDate: row.joiningDate,
            shopperId: row.shopperId,
            ibsId: row.ibsId,
            accountStatus: AccountStatus.ACTIVE,
            employmentStatus: EmploymentStatus.ACTIVE,
            profileStatus: ProfileStatus.COMPLETE,
            passwordHash: row.passwordHash,
            mustChangePassword: true,
            temporaryPasswordExpiresAt: row.temporaryPasswordExpiresAt,
            temporaryPasswordCiphertext: row.temporaryPasswordCiphertext,
            temporaryPasswordCreatedAt: importedAt
          },
          select: { id: true }
        });

        await tx.vendorChampAssignment.create({
          data: {
            champId: champ.id,
            vendorId: vendor.id,
            status: AssignmentStatus.ACTIVE,
            startDate: row.joiningDate ?? importedAt
          }
        });
      }

      for (const row of inactiveRows) {
        await tx.user.create({
          data: {
            role: UserRole.CHAMP,
            nameEn: row.nameEn,
            nameAr: row.nameAr,
            phoneNumber: row.phoneNumber,
            nationalId: row.nationalId,
            address: row.address,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender,
            joiningDate: row.joiningDate,
            shopperId: row.shopperId,
            ibsId: row.ibsId,
            resignationDate: row.resignationDate,
            accountStatus: AccountStatus.ARCHIVED,
            employmentStatus: EmploymentStatus.RESIGNED,
            profileStatus: ProfileStatus.COMPLETE,
            passwordHash: inactivePasswordHash,
            mustChangePassword: false,
            temporaryPasswordExpiresAt: null,
            temporaryPasswordCiphertext: null,
            temporaryPasswordCreatedAt: null
          }
        });
      }
    },
    { timeout: 120_000 }
  );

  console.log(`Import completed. Active Champ handoff report: ${reportPath}`);
}

function getOptions(args: string[]): ImportOptions {
  const fileArgIndex = args.findIndex((arg) => arg === "--file");
  const filePath =
    fileArgIndex >= 0
      ? args[fileArgIndex + 1]
      : undefined;

  if (!filePath) {
    throw new Error("Missing --file argument. Usage: npx tsx prisma/import-real-champs.ts --file <path>");
  }

  return {
    dryRun: args.includes("--dry-run"),
    filePath
  };
}

async function parseChampCsv(filePath: string) {
  const rows = parseCsv(await readFile(filePath, "utf8"));
  const dataRows = rows.slice(1);
  const validRows: CsvRow[] = [];
  let skippedBlankIdentityRows = 0;
  let skippedInvalidNationalId = 0;

  for (const [index, row] of dataRows.entries()) {
    const sourceLine = index + 2;
    const nameEn = clean(row[0]);
    const phoneNumber = clean(row[2]);
    const role = clean(row[3]).toLowerCase();
    const nationalId = clean(row[4]);

    if (!nameEn || !phoneNumber || !role || !nationalId) {
      skippedBlankIdentityRows += 1;
      continue;
    }

    if (role !== "champ") {
      continue;
    }

    if (!/^\d{14}$/.test(nationalId)) {
      console.warn(`Line ${sourceLine}: skipped — invalid nationalId "${nationalId}" (${nationalId.length} digits, expected 14)`);
      skippedInvalidNationalId += 1;
      continue;
    }

    validRows.push({
      sourceLine,
      nameEn,
      nameAr: cleanNullable(row[1]),
      phoneNumber,
      role,
      nationalId,
      gender: parseGender(row[5]),
      dateOfBirth: parseSheetDate(row[6]),
      address: cleanNullable(row[7]),
      joiningDate: parseSheetDate(row[8]),
      shopperId: cleanNullable(row[9]),
      ibsId: cleanNullable(row[10]),
      vendorCode: cleanNullable(row[11]),
      isActive: clean(row[12]).toUpperCase() === "TRUE",
      resignationDate: parseSheetDate(row[14])
    });
  }

  return {
    rawRows: dataRows.length,
    skippedBlankIdentityRows,
    skippedInvalidNationalId,
    validRows
  };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (current === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (current === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((current === "\n" || current === "\r") && !inQuotes) {
      if (current === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += current;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0)
  );
}

function dedupeRows(rows: CsvRow[]) {
  const parent = rows.map((_, index) => index);
  const firstSeenByKey = new Map<string, number>();

  const find = (index: number): number => {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  };

  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  rows.forEach((row, index) => {
    for (const key of uniqueKeys(row)) {
      const existingIndex = firstSeenByKey.get(key);
      if (existingIndex === undefined) {
        firstSeenByKey.set(key, index);
      } else {
        union(existingIndex, index);
      }
    }
  });

  const groups = new Map<number, CsvRow[]>();
  rows.forEach((row, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), row]);
  });

  const canonicalRows: CanonicalChamp[] = [];
  let duplicateRowsRemoved = 0;
  let duplicateGroups = 0;

  for (const groupRows of groups.values()) {
    const sorted = [...groupRows].sort(compareCanonicalRows);
    const winner = sorted[0];
    canonicalRows.push({
      ...winner,
      duplicateSourceLines: sorted.map((row) => row.sourceLine)
    });

    if (groupRows.length > 1) {
      duplicateGroups += 1;
      duplicateRowsRemoved += groupRows.length - 1;
    }
  }

  assertCanonicalRowsAreUnique(canonicalRows);

  return {
    canonicalRows,
    duplicateGroups,
    duplicateRowsRemoved
  };
}

function compareCanonicalRows(left: CsvRow, right: CsvRow) {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  const leftResignation = left.resignationDate?.getTime() ?? 0;
  const rightResignation = right.resignationDate?.getTime() ?? 0;
  if (!left.isActive && leftResignation !== rightResignation) {
    return rightResignation - leftResignation;
  }

  const leftJoining = left.joiningDate?.getTime() ?? 0;
  const rightJoining = right.joiningDate?.getTime() ?? 0;
  if (leftJoining !== rightJoining) {
    return rightJoining - leftJoining;
  }

  return right.sourceLine - left.sourceLine;
}

function uniqueKeys(row: CsvRow) {
  return [
    ["phone", row.phoneNumber],
    ["national", row.nationalId],
    ["shopper", row.shopperId],
    ["ibs", row.ibsId]
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}:${value}`);
}

function assertCanonicalRowsAreUnique(rows: CanonicalChamp[]) {
  for (const field of ["phoneNumber", "nationalId", "shopperId", "ibsId"] as const) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const value = row[field];
      if (!value) {
        continue;
      }
      const existingLine = seen.get(value);
      if (existingLine) {
        throw new Error(
          `Dedupe failed. ${field} ${value} remains duplicated at lines ${existingLine} and ${row.sourceLine}.`
        );
      }
      seen.set(value, row.sourceLine);
    }
  }
}

async function assertNoNonChampUniqueConflicts(rows: CanonicalChamp[]) {
  const phoneNumbers = collectUnique(rows.map((row) => row.phoneNumber));
  const nationalIds = collectUnique(rows.map((row) => row.nationalId));
  const shopperIds = collectUnique(rows.map((row) => row.shopperId));
  const ibsIds = collectUnique(rows.map((row) => row.ibsId));

  const conflicts = await prisma.user.findMany({
    where: {
      role: { not: UserRole.CHAMP },
      OR: [
        { phoneNumber: { in: phoneNumbers } },
        { nationalId: { in: nationalIds } },
        { shopperId: { in: shopperIds } },
        { ibsId: { in: ibsIds } }
      ]
    },
    select: {
      role: true,
      nameEn: true,
      phoneNumber: true,
      nationalId: true,
      shopperId: true,
      ibsId: true
    }
  });

  if (conflicts.length) {
    throw new Error(
      `Import blocked. CSV conflicts with non-Champ users: ${JSON.stringify(
        conflicts.slice(0, 10)
      )}`
    );
  }
}

async function deleteExistingChampData(tx: Prisma.TransactionClient) {
  const existingChamps = await tx.user.findMany({
    where: { role: UserRole.CHAMP },
    select: { id: true }
  });
  const champIds = existingChamps.map((champ) => champ.id);

  if (!champIds.length) {
    return;
  }

  const existingRequests = await tx.request.findMany({
    where: {
      OR: [
        { createdById: { in: champIds } },
        { targetUserId: { in: champIds } }
      ]
    },
    select: { id: true }
  });
  const requestIds = existingRequests.map((request) => request.id);

  const existingAssignments = await tx.vendorChampAssignment.findMany({
    where: { champId: { in: champIds } },
    select: { id: true }
  });
  const assignmentIds = existingAssignments.map((assignment) => assignment.id);

  await deleteRelatedNotifications(tx, champIds, requestIds);

  await tx.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: { in: champIds } },
        { entityType: "User", entityId: { in: champIds } },
        { entityType: "Request", entityId: { in: requestIds } },
        { entityType: "VendorChampAssignment", entityId: { in: assignmentIds } }
      ]
    }
  });

  await tx.vendorChampAssignment.deleteMany({
    where: { id: { in: assignmentIds } }
  });
  // Cascades RequestApproval deletion for Champ-created/targeted requests.
  // RequestApprovals where Champ was approver are handled by onDelete: SetNull.
  await tx.request.deleteMany({ where: { id: { in: requestIds } } });
  await tx.user.deleteMany({ where: { id: { in: champIds } } });
}

async function deleteRelatedNotifications(
  tx: Prisma.TransactionClient,
  champIds: string[],
  requestIds: string[]
) {
  await tx.notification.deleteMany({ where: { userId: { in: champIds } } });

  if (!champIds.length && !requestIds.length) {
    return;
  }

  const requestIdList = requestIds.length
    ? Prisma.sql`OR payload->>'requestId' IN (${Prisma.join(requestIds)})`
    : Prisma.empty;
  const champIdList = champIds.length
    ? Prisma.sql`OR payload->>'champId' IN (${Prisma.join(champIds)})`
    : Prisma.empty;

  await tx.$executeRaw`
    DELETE FROM "Notification"
    WHERE FALSE
    ${requestIdList}
    ${champIdList}
  `;
}

async function writeImportReport(
  activeRows: PreparedActiveChamp[],
  vendorByCode: Map<string, { vendorName: string; vendorCode: string }>,
  importedAt: Date
) {
  await mkdir(REPORT_DIR, { recursive: true });
  const timestamp = importedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const reportPath = path.join(REPORT_DIR, `champ-import-${timestamp}.csv`);
  const lines = [
    [
      "nameEn",
      "nameAr",
      "phoneNumber",
      "nationalId",
      "shopperId",
      "ibsId",
      "vendorCode",
      "vendorName",
      "temporaryPassword",
      "temporaryPasswordExpiresAt"
    ].join(",")
  ];

  for (const row of activeRows) {
    const vendor = vendorByCode.get(row.vendorCode ?? "");
    lines.push(
      [
        row.nameEn,
        row.nameAr ?? "",
        row.phoneNumber,
        row.nationalId,
        row.shopperId ?? "",
        row.ibsId ?? "",
        row.vendorCode ?? "",
        vendor?.vendorName ?? "",
        row.temporaryPassword,
        row.temporaryPasswordExpiresAt.toISOString()
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  return reportPath;
}

function printSummary(summary: Record<string, number>, dryRun: boolean) {
  console.log(dryRun ? "Dry run summary:" : "Import summary:");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`${key}: ${value}`);
  }
}

function generateTemporaryPassword() {
  return `SN-${randomBytes(12).toString("base64url")}`;
}

function encryptTemporaryPassword(temporaryPassword: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(temporaryPassword, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function getEncryptionKey() {
  const configuredKey =
    process.env.TEMP_PASSWORD_ENCRYPTION_KEY ?? process.env.JWT_SECRET;

  if (!configuredKey) {
    throw new Error(
      "TEMP_PASSWORD_ENCRYPTION_KEY or JWT_SECRET must be set before importing Champs."
    );
  }

  return createHash("sha256").update(configuredKey).digest();
}

function parseGender(value: string | undefined) {
  const normalized = clean(value).toUpperCase();
  if (normalized === "MALE" || normalized === "M") {
    return Gender.MALE;
  }
  if (normalized === "FEMALE" || normalized === "F") {
    return Gender.FEMALE;
  }
  return Gender.UNSPECIFIED;
}

function parseSheetDate(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split("/");
  if (parts.length !== 3) {
    return null;
  }

  const [month, day, year] = parts.map((part) => Number(part));
  if (!month || !day || !year) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function cleanNullable(value: string | undefined) {
  const cleaned = clean(value);
  return cleaned.length ? cleaned : null;
}

function collectUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
