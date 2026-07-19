import "dotenv/config";

import {
  AccountStatus,
  AssignmentStatus,
  AttendanceImportBatchStatus,
  EmploymentStatus,
  OrdersKpiImportBatchStatus,
  OrdersKpiPickerMatchStatus,
  Prisma,
  PrismaClient,
  ProfileStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;
const ADMIN_COUNT = 1;
const AREA_MANAGER_COUNT = 7;
const CHAMP_COUNT = 50;
const PICKER_SAMPLE_COUNT = 35;
const OUTPUT_DIR = path.join(process.cwd(), "output", "demo-data");
const NATIONAL_ID_PREFIX = {
  admin: "29907189",
  areaManager: "29907190",
  champ: "29907191"
} as const;
const PHONE_PREFIX = {
  admin: "010969",
  areaManager: "010970",
  champ: "010971"
} as const;
const ADMIN_NAMES = ["Omar Farouk"];
const AREA_MANAGER_NAMES = [
  "Ahmed Nabil",
  "Mona Hany",
  "Karim Fathy",
  "Yasmine Adel",
  "Mahmoud Samir",
  "Nour Khaled",
  "Tarek Hassan"
];
const CHAMP_NAMES = [
  "Mostafa Ali",
  "Sara Mohamed",
  "Hossam Adel",
  "Dina Samy",
  "Mohamed Tamer",
  "Reem Ashraf",
  "Youssef Magdy",
  "Nada Ibrahim",
  "Amr Nasser",
  "Farah Wael",
  "Khaled Sherif",
  "Aya Mostafa",
  "Hany Gamal",
  "Salma Fawzy",
  "Omar Essam",
  "Mariam Atef",
  "Islam Yasser",
  "Menna Adel",
  "Ayman Lotfy",
  "Jana Hossam",
  "Sherif Reda",
  "Rana Khalil",
  "Hazem Fouad",
  "Nouran Said",
  "Walid Emad",
  "Heba Magdy",
  "Fady Ramy",
  "Mai Hassan",
  "Eslam Saeed",
  "Laila Tarek",
  "Adel Sameh",
  "Basmt Ahmed",
  "Nader Kamal",
  "Yara Ashraf",
  "Ramy Sabry",
  "Hager Nabil",
  "Tamer Salah",
  "Dalia Fathy",
  "Mahmoud Osama",
  "Maha Khaled",
  "Seif Hany",
  "Nermin Ali",
  "Bassem Youssef",
  "Radwa Samir",
  "Hussein Adel",
  "Asmaa Mahmoud",
  "Wael Nasser",
  "Noha Farid",
  "Sameh Amin",
  "Shahd Karim"
];
type ActiveChain = {
  id: string;
  chainCode: string;
  chainName: string;
};

type ActiveVendor = {
  id: string;
  vendorCode: string;
  vendorName: string;
  chainId: string;
  chain: ActiveChain;
};

type SeededUser = {
  id: string;
  role: UserRole;
  nameEn: string;
  nationalId: string;
  phoneNumber: string;
  password: string;
  activeVendor?: ActiveVendor;
};

type PreparedSeededUser = SeededUser & {
  passwordHash: string;
};

type ChampBranchTeam = {
  champ: PreparedSeededUser;
  vendor: ActiveVendor;
};

type PickerTeam = {
  picker: PreparedSeededUser;
  vendor: ActiveVendor;
  champ: PreparedSeededUser;
  areaManager: PreparedSeededUser;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const periodMonth = getPeriodMonth();
  const periodRange = getPeriodRange(periodMonth);
  const importedAt = new Date();
  assertNameInventory();
  const [chains, vendors] = await Promise.all([
    prisma.chain.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ chainName: "asc" }, { chainCode: "asc" }],
      select: { id: true, chainCode: true, chainName: true }
    }),
    prisma.vendor.findMany({
      where: { status: "ACTIVE", chain: { status: "ACTIVE" } },
      orderBy: [
        { chain: { chainName: "asc" } },
        { vendorName: "asc" },
        { vendorCode: "asc" }
      ],
      select: {
        id: true,
        vendorCode: true,
        vendorName: true,
        chainId: true,
        chain: {
          select: { id: true, chainCode: true, chainName: true }
        }
      }
    })
  ]);

  assertSeedableOrganization(chains, vendors);
  await assertNoNonDemoActiveAssignmentConflicts(chains, vendors);

  const adminUsers = buildSeedUsers(
    UserRole.ADMIN,
    ADMIN_NAMES,
    NATIONAL_ID_PREFIX.admin,
    PHONE_PREFIX.admin
  );
  const areaManagerUsers = buildSeedUsers(
    UserRole.AREA_MANAGER,
    AREA_MANAGER_NAMES,
    NATIONAL_ID_PREFIX.areaManager,
    PHONE_PREFIX.areaManager
  );
  const champUsers = buildSeedUsers(
    UserRole.CHAMP,
    CHAMP_NAMES,
    NATIONAL_ID_PREFIX.champ,
    PHONE_PREFIX.champ
  );
  const pickerUsers = await selectExistingPickerUsers(periodMonth, periodRange);

  await assertNoNonSeededIdentityConflicts([
    ...adminUsers,
    ...areaManagerUsers,
    ...champUsers
  ]);

  if (dryRun) {
    console.log(
      [
        "Workforce seed dry run passed.",
        `Would seed ${ADMIN_COUNT} Admin, ${AREA_MANAGER_COUNT} Area Managers, ${CHAMP_COUNT} Champs.`,
        `Would reset ${PICKER_SAMPLE_COUNT} existing Picker passwords from ${periodMonth} Attendance + UHO data.`,
        `Would assign ${chains.length} Chains and ${vendors.length} Branches.`
      ].join("\n")
    );
    return;
  }

  const [admins, areaManagers, champs, pickers] = await Promise.all([
    prepareUsers(adminUsers),
    prepareUsers(areaManagerUsers),
    prepareUsers(champUsers),
    prepareUsers(pickerUsers)
  ]);
  const areaManagerByChainId = distributeAreaManagers(chains, areaManagers);
  const champBranchTeams = distributeChamps(vendors, champs);
  const champByVendorId = new Map(
    champBranchTeams.map((team) => [team.vendor.id, team.champ])
  );
  const pickerTeams = buildExistingPickerTeams(pickers, champByVendorId, areaManagerByChainId);

  const persistedUsers = await prisma.$transaction(
    async (tx) => {
      await removePreviousDemoAssignments(tx);

      const persistedAdmins = await upsertDemoUsers(tx, admins);
      const persistedAreaManagers = await upsertDemoUsers(tx, areaManagers);
      const persistedChamps = await upsertDemoUsers(tx, champs);
      const persistedPickers = await updateExistingPickerPasswords(tx, pickers);

      const persistedAreaManagerByNationalId = byNationalId(persistedAreaManagers);
      const persistedChampByNationalId = byNationalId(persistedChamps);

      await tx.chainAreaManagerAssignment.createMany({
        data: chains.map((chain) => {
          const areaManager = areaManagerByChainId.get(chain.id);

          if (!areaManager) {
            throw new Error(`Missing Area Manager for Chain ${chain.chainCode}.`);
          }

          return {
            areaManagerId: getPersistedUserId(
              persistedAreaManagerByNationalId,
              areaManager
            ),
            chainId: chain.id,
            status: AssignmentStatus.ACTIVE,
            startDate: importedAt
          };
        })
      });

      await tx.vendorChampAssignment.createMany({
        data: champBranchTeams.map((team) => ({
          champId: getPersistedUserId(persistedChampByNationalId, team.champ),
          vendorId: team.vendor.id,
          status: AssignmentStatus.ACTIVE,
          startDate: importedAt
        }))
      });

      return {
        admins: persistedAdmins,
        areaManagers: persistedAreaManagers,
        champs: persistedChamps,
        pickers: persistedPickers
      };
    },
    { timeout: 120_000 }
  );

  const workbookPath = await writeWorkbook({
    areaManagerByChainId,
    admins: persistedUsers.admins,
    areaManagers: persistedUsers.areaManagers,
    champBranchTeams,
    champs: persistedUsers.champs,
    chains,
    generatedAt: importedAt,
    pickerTeams,
    pickers: persistedUsers.pickers
  });

  console.log(
    [
      `Seeded workforce accounts: ${ADMIN_COUNT} Admin, ${AREA_MANAGER_COUNT} Area Managers, ${CHAMP_COUNT} Champs.`,
      `Reset passwords for ${PICKER_SAMPLE_COUNT} existing Pickers with ${periodMonth} Attendance + UHO data.`,
      `Assigned ${chains.length} Chains, ${vendors.length} Branches.`,
      `Credential workbook: ${workbookPath}`
    ].join("\n")
  );
}

function assertSeedableOrganization(chains: ActiveChain[], vendors: ActiveVendor[]) {
  if (chains.length < AREA_MANAGER_COUNT) {
    throw new Error(
      `Workforce seed needs at least ${AREA_MANAGER_COUNT} active Chains; found ${chains.length}.`
    );
  }

  if (vendors.length < CHAMP_COUNT) {
    throw new Error(
      `Workforce seed needs at least ${CHAMP_COUNT} active Branches; found ${vendors.length}.`
    );
  }
}

function assertNameInventory() {
  const expectedCounts: Array<[string, number, number]> = [
    ["Admin", ADMIN_COUNT, ADMIN_NAMES.length],
    ["Area Manager", AREA_MANAGER_COUNT, AREA_MANAGER_NAMES.length],
    ["Champ", CHAMP_COUNT, CHAMP_NAMES.length]
  ];

  const mismatch = expectedCounts.find(([, expected, actual]) => expected !== actual);

  if (mismatch) {
    const [label, expected, actual] = mismatch;
    throw new Error(`${label} names count must be ${expected}; found ${actual}.`);
  }
}

async function selectExistingPickerUsers(
  periodMonth: string,
  periodRange: { start: Date; endExclusive: Date }
): Promise<SeededUser[]> {
  const pickers = await prisma.user.findMany({
    where: {
      role: UserRole.PICKER,
      accountStatus: AccountStatus.ACTIVE,
      employmentStatus: EmploymentStatus.ACTIVE,
      attendanceDailyRecords: {
        some: {
          periodMonth,
          importBatch: { status: AttendanceImportBatchStatus.ACTIVE }
        }
      },
      ordersKpiDailyMatchedRows: {
        some: {
          kpiDate: {
            gte: periodRange.start,
            lt: periodRange.endExclusive
          },
          pickerMatchStatus: OrdersKpiPickerMatchStatus.MATCHED_PICKER,
          sourceBatch: { status: OrdersKpiImportBatchStatus.CONFIRMED }
        }
      },
      pickerBranchAssignments: {
        some: { status: AssignmentStatus.ACTIVE }
      }
    },
    orderBy: [{ nameEn: "asc" }, { nationalId: "asc" }],
    take: PICKER_SAMPLE_COUNT,
    select: {
      id: true,
      nameEn: true,
      nationalId: true,
      phoneNumber: true,
      role: true,
      pickerBranchAssignments: {
        where: { status: AssignmentStatus.ACTIVE },
        take: 1,
        select: {
          vendor: {
            select: {
              id: true,
              vendorCode: true,
              vendorName: true,
              chainId: true,
              chain: {
                select: { id: true, chainCode: true, chainName: true }
              }
            }
          }
        }
      }
    }
  });

  if (pickers.length < PICKER_SAMPLE_COUNT) {
    throw new Error(
      `Need ${PICKER_SAMPLE_COUNT} active Pickers with ${periodMonth} Attendance and UHO data; found ${pickers.length}.`
    );
  }

  return pickers.map((picker, index) => {
    const activeVendor = picker.pickerBranchAssignments[0]?.vendor;

    if (!activeVendor) {
      throw new Error(`Picker ${picker.nationalId} has no active Branch assignment.`);
    }

    return {
      activeVendor,
      id: picker.id,
      nameEn: picker.nameEn,
      nationalId: picker.nationalId,
      password: `SN-PK-${(index + 1).toString().padStart(2, "0")}-2026!`,
      phoneNumber: picker.phoneNumber,
      role: picker.role
    };
  });
}

function getPeriodMonth() {
  const periodArg = process.argv
    .find((arg) => arg.startsWith("--periodMonth="))
    ?.split("=")[1]
    ?.trim();

  if (periodArg) {
    if (!/^\d{4}-\d{2}$/.test(periodArg)) {
      throw new Error("--periodMonth must use YYYY-MM.");
    }

    return periodArg;
  }

  return new Date().toISOString().slice(0, 7);
}

function getPeriodRange(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const endExclusive = new Date(Date.UTC(year, month, 1));

  return { endExclusive, start };
}

async function assertNoNonDemoActiveAssignmentConflicts(
  chains: ActiveChain[],
  vendors: ActiveVendor[]
) {
  const demoNationalIdPrefixes = Object.values(NATIONAL_ID_PREFIX);
  const [chainConflicts, vendorConflicts] = await Promise.all([
    prisma.chainAreaManagerAssignment.findMany({
      where: {
        chainId: { in: chains.map((chain) => chain.id) },
        status: AssignmentStatus.ACTIVE,
        areaManager: {
          NOT: demoNationalIdPrefixes.map((prefix) => ({
            nationalId: { startsWith: prefix }
          }))
        }
      },
      include: { areaManager: true, chain: true }
    }),
    prisma.vendorChampAssignment.findMany({
      where: {
        vendorId: { in: vendors.map((vendor) => vendor.id) },
        status: AssignmentStatus.ACTIVE,
        champ: {
          NOT: demoNationalIdPrefixes.map((prefix) => ({
            nationalId: { startsWith: prefix }
          }))
        }
      },
      include: { champ: true, vendor: true }
    })
  ]);

  if (chainConflicts.length || vendorConflicts.length) {
    const chainMessages = chainConflicts.map(
      (assignment) =>
        `${assignment.chain.chainCode} already has ${assignment.areaManager.nameEn}`
    );
    const vendorMessages = vendorConflicts.map(
      (assignment) =>
        `${assignment.vendor.vendorCode} already has ${assignment.champ.nameEn}`
    );

    throw new Error(
      [
        "Workforce seed blocked to avoid overwriting non-seeded active assignments.",
        ...chainMessages,
        ...vendorMessages
      ].join("\n")
    );
  }
}

async function assertNoNonSeededIdentityConflicts(users: SeededUser[]) {
  const seededPrefixes = Object.values(NATIONAL_ID_PREFIX);
  const nationalIds = users.map((user) => user.nationalId);
  const phoneNumbers = users.map((user) => user.phoneNumber);
  const conflicts = await prisma.user.findMany({
    where: {
      OR: [
        { nationalId: { in: nationalIds } },
        { phoneNumber: { in: phoneNumbers } }
      ],
      NOT: seededPrefixes.map((prefix) => ({
        nationalId: { startsWith: prefix }
      }))
    },
    select: {
      nameEn: true,
      nationalId: true,
      phoneNumber: true
    }
  });

  if (conflicts.length) {
    throw new Error(
      [
        "Workforce seed blocked to avoid overwriting existing users.",
        ...conflicts.map(
          (user) => `${user.nameEn} (${user.nationalId}, ${user.phoneNumber})`
        )
      ].join("\n")
    );
  }
}

async function removePreviousDemoAssignments(tx: Prisma.TransactionClient) {
  const demoUsers = await tx.user.findMany({
    where: {
      OR: Object.values(NATIONAL_ID_PREFIX).map((prefix) => ({
        nationalId: { startsWith: prefix }
      }))
    },
    select: { id: true }
  });
  const demoUserIds = demoUsers.map((user) => user.id);

  if (!demoUserIds.length) {
    return;
  }

  await tx.pickerBranchAssignment.deleteMany({
    where: { pickerId: { in: demoUserIds } }
  });
  await tx.vendorChampAssignment.deleteMany({
    where: { champId: { in: demoUserIds } }
  });
  await tx.chainAreaManagerAssignment.deleteMany({
    where: { areaManagerId: { in: demoUserIds } }
  });
}

async function upsertDemoUsers(
  tx: Prisma.TransactionClient,
  users: PreparedSeededUser[]
) {
  const persisted: PreparedSeededUser[] = [];

  for (const user of users) {
    const savedUser = await tx.user.upsert({
      where: { nationalId: user.nationalId },
      update: {
        role: user.role,
        nameEn: user.nameEn,
        phoneNumber: user.phoneNumber,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE,
        profileStatus: ProfileStatus.COMPLETE,
        passwordHash: user.passwordHash,
        mustChangePassword: false,
        temporaryPasswordCiphertext: null,
        temporaryPasswordCreatedAt: null,
        temporaryPasswordExpiresAt: null
      },
      create: {
        role: user.role,
        nameEn: user.nameEn,
        phoneNumber: user.phoneNumber,
        nationalId: user.nationalId,
        accountStatus: AccountStatus.ACTIVE,
        employmentStatus: EmploymentStatus.ACTIVE,
        profileStatus: ProfileStatus.COMPLETE,
        passwordHash: user.passwordHash,
        mustChangePassword: false
      },
      select: {
        id: true,
        role: true,
        nameEn: true,
        nationalId: true,
        phoneNumber: true
      }
    });

    persisted.push({ ...user, id: savedUser.id });
  }

  return persisted;
}

async function updateExistingPickerPasswords(
  tx: Prisma.TransactionClient,
  pickers: PreparedSeededUser[]
) {
  const persisted: PreparedSeededUser[] = [];

  for (const picker of pickers) {
    const savedUser = await tx.user.update({
      where: { id: picker.id },
      data: {
        passwordHash: picker.passwordHash,
        mustChangePassword: false,
        temporaryPasswordCiphertext: null,
        temporaryPasswordCreatedAt: null,
        temporaryPasswordExpiresAt: null
      },
      select: {
        id: true,
        role: true,
        nameEn: true,
        nationalId: true,
        phoneNumber: true
      }
    });

    persisted.push({ ...picker, id: savedUser.id });
  }

  return persisted;
}

async function prepareUsers(users: SeededUser[]): Promise<PreparedSeededUser[]> {
  return Promise.all(
    users.map(async (user) => ({
      ...user,
      passwordHash: await bcrypt.hash(user.password, PASSWORD_HASH_ROUNDS)
    }))
  );
}

function buildSeedUsers(
  role: UserRole,
  names: string[],
  nationalIdPrefix: string,
  phonePrefix: string
): SeededUser[] {
  return names.map((nameEn, index) => {
    const number = index + 1;
    const padded = number.toString().padStart(2, "0");

    return {
      id: "",
      role,
      nameEn,
      nationalId: `${nationalIdPrefix}${number.toString().padStart(6, "0")}`,
      phoneNumber: `${phonePrefix}${number.toString().padStart(5, "0")}`,
      password: `SN-${roleLabel(role)}-${padded}-2026!`
    };
  });
}

function roleLabel(role: UserRole) {
  if (role === UserRole.AREA_MANAGER) {
    return "AM";
  }

  if (role === UserRole.CHAMP) {
    return "CH";
  }

  return "PK";
}

function distributeAreaManagers(
  chains: ActiveChain[],
  areaManagers: PreparedSeededUser[]
) {
  const areaManagerByChainId = new Map<string, PreparedSeededUser>();

  chains.forEach((chain, index) => {
    areaManagerByChainId.set(chain.id, areaManagers[index % areaManagers.length]);
  });

  return areaManagerByChainId;
}

function distributeChamps(vendors: ActiveVendor[], champs: PreparedSeededUser[]) {
  return vendors.map((vendor, index) => ({
    champ: champs[index % champs.length],
    vendor
  }));
}

function buildExistingPickerTeams(
  pickers: PreparedSeededUser[],
  champByVendorId: Map<string, PreparedSeededUser>,
  areaManagerByChainId: Map<string, PreparedSeededUser>
): PickerTeam[] {
  return pickers.map((picker) => {
    const vendor = picker.activeVendor;

    if (!vendor) {
      throw new Error(`Picker ${picker.nationalId} has no selected Branch.`);
    }

    const champ = champByVendorId.get(vendor.id);
    const areaManager = areaManagerByChainId.get(vendor.chainId);

    if (!champ || !areaManager) {
      throw new Error(`Missing team for Branch ${vendor.vendorCode}.`);
    }

    return { areaManager, champ, picker, vendor };
  });
}

function byNationalId(users: PreparedSeededUser[]) {
  return new Map(users.map((user) => [user.nationalId, user.id]));
}

function getPersistedUserId(
  usersByNationalId: Map<string, string>,
  user: PreparedSeededUser
) {
  const id = usersByNationalId.get(user.nationalId);

  if (!id) {
    throw new Error(`Missing persisted user ${user.nationalId}.`);
  }

  return id;
}

async function writeWorkbook({
  areaManagerByChainId,
  admins,
  areaManagers,
  champBranchTeams,
  champs,
  chains,
  generatedAt,
  pickerTeams,
  pickers
}: {
  areaManagerByChainId: Map<string, PreparedSeededUser>;
  admins: PreparedSeededUser[];
  areaManagers: PreparedSeededUser[];
  champBranchTeams: ChampBranchTeam[];
  champs: PreparedSeededUser[];
  chains: ActiveChain[];
  generatedAt: Date;
  pickerTeams: PickerTeam[];
  pickers: PreparedSeededUser[];
}) {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SuperNova Workforce Seed";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  writeCredentialsSheet(workbook, [
    ...admins,
    ...areaManagers,
    ...champs,
    ...pickers
  ]);
  writeAreaManagerTeamsSheet(workbook, areaManagerByChainId, chains);
  writeChampBranchTeamsSheet(workbook, champBranchTeams);
  writePickerSampleSheet(workbook, pickerTeams);
  writeSummarySheet(workbook, {
    admins: admins.length,
    areaManagers: areaManagers.length,
    branches: champBranchTeams.length,
    champs: champs.length,
    generatedAt,
    pickers: pickers.length
  });

  const fileName = `supernova-workforce-credentials-${formatTimestamp(generatedAt)}.xlsx`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  await workbook.xlsx.writeFile(outputPath);

  return outputPath;
}

function writeCredentialsSheet(
  workbook: ExcelJS.Workbook,
  users: PreparedSeededUser[]
) {
  const sheet = workbook.addWorksheet("Credentials");
  sheet.columns = [
    { header: "Role", key: "role", width: 18 },
    { header: "Name", key: "nameEn", width: 26 },
    { header: "National ID", key: "nationalId", width: 18 },
    { header: "Password", key: "password", width: 20 },
    { header: "Phone", key: "phoneNumber", width: 16 }
  ];
  sheet.addRows(users);
  styleSheet(sheet);
}

function writeAreaManagerTeamsSheet(
  workbook: ExcelJS.Workbook,
  areaManagerByChainId: Map<string, PreparedSeededUser>,
  chains: ActiveChain[]
) {
  const sheet = workbook.addWorksheet("Area Manager Teams");
  sheet.columns = [
    { header: "Area Manager", key: "areaManager", width: 28 },
    { header: "National ID", key: "nationalId", width: 18 },
    { header: "Chain", key: "chain", width: 28 },
    { header: "Chain Code", key: "chainCode", width: 16 }
  ];

  for (const chain of chains) {
    const areaManager = areaManagerByChainId.get(chain.id);

    if (!areaManager) {
      continue;
    }

    sheet.addRow({
      areaManager: areaManager.nameEn,
      nationalId: areaManager.nationalId,
      chain: chain.chainName,
      chainCode: chain.chainCode
    });
  }

  styleSheet(sheet);
}

function writeChampBranchTeamsSheet(
  workbook: ExcelJS.Workbook,
  champBranchTeams: ChampBranchTeam[]
) {
  const sheet = workbook.addWorksheet("Champ Branch Teams");
  sheet.columns = [
    { header: "Champ", key: "champ", width: 24 },
    { header: "National ID", key: "nationalId", width: 18 },
    { header: "Chain", key: "chain", width: 28 },
    { header: "Branch", key: "branch", width: 32 },
    { header: "Branch Code", key: "branchCode", width: 16 }
  ];
  sheet.addRows(
    champBranchTeams.map((team) => ({
      champ: team.champ.nameEn,
      nationalId: team.champ.nationalId,
      chain: team.vendor.chain.chainName,
      branch: team.vendor.vendorName,
      branchCode: team.vendor.vendorCode
    }))
  );
  styleSheet(sheet);
}

function writePickerSampleSheet(
  workbook: ExcelJS.Workbook,
  pickerTeams: PickerTeam[]
) {
  const sheet = workbook.addWorksheet("Picker Accounts");
  sheet.columns = [
    { header: "Picker", key: "picker", width: 24 },
    { header: "National ID", key: "nationalId", width: 18 },
    { header: "Password", key: "password", width: 18 },
    { header: "Branch", key: "branch", width: 32 },
    { header: "Branch Code", key: "branchCode", width: 16 },
    { header: "Champ", key: "champ", width: 24 },
    { header: "Area Manager", key: "areaManager", width: 28 }
  ];
  sheet.addRows(
    pickerTeams.map((team) => ({
      picker: team.picker.nameEn,
      nationalId: team.picker.nationalId,
      password: team.picker.password,
      branch: team.vendor.vendorName,
      branchCode: team.vendor.vendorCode,
      champ: team.champ.nameEn,
      areaManager: team.areaManager.nameEn
    }))
  );
  styleSheet(sheet);
}

function writeSummarySheet(
  workbook: ExcelJS.Workbook,
  summary: {
    admins: number;
    areaManagers: number;
    branches: number;
    champs: number;
    generatedAt: Date;
    pickers: number;
  }
) {
  const sheet = workbook.addWorksheet("Summary");
  sheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 24 }
  ];
  sheet.addRows([
    { metric: "Generated At", value: summary.generatedAt.toISOString() },
    { metric: "Admins", value: summary.admins },
    { metric: "Area Managers", value: summary.areaManagers },
    { metric: "Champs", value: summary.champs },
    { metric: "Picker Accounts", value: summary.pickers },
    { metric: "Assigned Branches", value: summary.branches }
  ]);
  styleSheet(sheet);
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF3EB" }
  };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.autoFilter = {
    from: "A1",
    to: `${sheet.getColumn(sheet.columnCount).letter}1`
  };
}

function formatTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
