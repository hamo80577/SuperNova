import {
  DeductionPenaltyType,
  DeductionPolicyStatus,
  PrismaClient,
  UserRole
} from "@prisma/client";
import { readFile } from "fs/promises";
import path from "path";

type RuleSeed = {
  occurrenceNumber: number;
  appliesFromOccurrence?: number;
  penaltyType: DeductionPenaltyType;
  deductionDays?: number;
  label: string;
};

type ActionSeed = {
  code: string;
  name: string;
  description: string;
  rules: RuleSeed[];
};

type PolicySeed = {
  versionNumber: number;
  actions: ActionSeed[];
};

const DEDUCTION_POLICY_DATA_PATH = path.join(
  process.cwd(),
  "prisma",
  "data",
  "deduction-policy.json"
);

export async function seedDeductionPolicy(prisma: PrismaClient) {
  const policySeed = await loadDeductionPolicySeed();
  const existing = await prisma.deductionPolicyVersion.findFirst({
    where: { status: DeductionPolicyStatus.ACTIVE },
    select: { id: true, versionNumber: true }
  });

  if (existing) {
    console.log(
      `Deduction policy already active (version ${existing.versionNumber}); skipping seed.`
    );
    return existing;
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] } },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!adminUser) {
    console.log("No admin user found; skipping deduction policy seed.");
    return null;
  }

  const policy = await prisma.deductionPolicyVersion.create({
    data: {
      versionNumber: policySeed.versionNumber,
      status: DeductionPolicyStatus.ACTIVE,
      effectiveFrom: new Date(),
      createdById: adminUser.id,
      actions: {
        create: policySeed.actions.map((action) => ({
          code: action.code,
          name: action.name,
          description: action.description,
          ruleSteps: {
            create: action.rules.map((rule) => ({
              occurrenceNumber: rule.occurrenceNumber,
              appliesFromOccurrence: rule.appliesFromOccurrence ?? null,
              penaltyType: rule.penaltyType,
              deductionDays: rule.deductionDays ?? null,
              label: rule.label
            }))
          }
        }))
      }
    },
    select: { id: true, versionNumber: true }
  });

  console.log(
    `Seeded Deduction policy version ${policy.versionNumber} with ${policySeed.actions.length} actions.`
  );
  return policy;
}

async function loadDeductionPolicySeed(): Promise<PolicySeed> {
  const raw = JSON.parse(
    await readFile(DEDUCTION_POLICY_DATA_PATH, { encoding: "utf8" })
  ) as unknown;

  return parsePolicySeed(raw);
}

function parsePolicySeed(raw: unknown): PolicySeed {
  if (!raw || typeof raw !== "object") {
    throw new Error("Deduction policy seed must be a JSON object.");
  }

  const data = raw as Record<string, unknown>;
  const versionNumber = parsePositiveInteger(
    data.versionNumber,
    "versionNumber"
  );

  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error("Deduction policy seed must include at least one action.");
  }

  const seenCodes = new Set<string>();
  const actions = data.actions.map((item, index) => {
    const action = parseActionSeed(item, `actions[${index}]`);

    if (seenCodes.has(action.code)) {
      throw new Error(`Duplicate deduction policy action code: ${action.code}.`);
    }

    seenCodes.add(action.code);
    return action;
  });

  return { versionNumber, actions };
}

function parseActionSeed(raw: unknown, pathName: string): ActionSeed {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${pathName} must be a JSON object.`);
  }

  const data = raw as Record<string, unknown>;
  const code = parseRequiredString(data.code, `${pathName}.code`).toUpperCase();
  const name = parseRequiredString(data.name, `${pathName}.name`);
  const description = parseRequiredString(
    data.description,
    `${pathName}.description`
  );

  if (!Array.isArray(data.rules) || data.rules.length === 0) {
    throw new Error(`${pathName}.rules must include at least one rule.`);
  }

  const seenOccurrences = new Set<number>();
  const rules = data.rules.map((item, index) => {
    const rule = parseRuleSeed(item, `${pathName}.rules[${index}]`);

    if (seenOccurrences.has(rule.occurrenceNumber)) {
      throw new Error(
        `${pathName} has duplicate occurrenceNumber ${rule.occurrenceNumber}.`
      );
    }

    seenOccurrences.add(rule.occurrenceNumber);
    return rule;
  });

  return { code, name, description, rules };
}

function parseRuleSeed(raw: unknown, pathName: string): RuleSeed {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${pathName} must be a JSON object.`);
  }

  const data = raw as Record<string, unknown>;
  const occurrenceNumber = parsePositiveInteger(
    data.occurrenceNumber,
    `${pathName}.occurrenceNumber`
  );
  const appliesFromOccurrence =
    data.appliesFromOccurrence === undefined
      ? undefined
      : parsePositiveInteger(
          data.appliesFromOccurrence,
          `${pathName}.appliesFromOccurrence`
        );
  const penaltyType = parsePenaltyType(data.penaltyType, `${pathName}.penaltyType`);
  const deductionDays =
    data.deductionDays === undefined
      ? undefined
      : parseNonNegativeNumber(data.deductionDays, `${pathName}.deductionDays`);
  const label = parseRequiredString(data.label, `${pathName}.label`);

  if (penaltyType === DeductionPenaltyType.DEDUCTION_DAYS && deductionDays === undefined) {
    throw new Error(`${pathName}.deductionDays is required for DEDUCTION_DAYS.`);
  }

  if (penaltyType !== DeductionPenaltyType.DEDUCTION_DAYS && deductionDays !== undefined) {
    throw new Error(`${pathName}.deductionDays is only valid for DEDUCTION_DAYS.`);
  }

  return {
    occurrenceNumber,
    ...(appliesFromOccurrence ? { appliesFromOccurrence } : {}),
    penaltyType,
    ...(deductionDays === undefined ? {} : { deductionDays }),
    label
  };
}

function parsePenaltyType(value: unknown, pathName: string): DeductionPenaltyType {
  if (
    typeof value === "string" &&
    Object.values(DeductionPenaltyType).includes(value as DeductionPenaltyType)
  ) {
    return value as DeductionPenaltyType;
  }

  throw new Error(`${pathName} must be a valid DeductionPenaltyType.`);
}

function parseRequiredString(value: unknown, pathName: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error(`${pathName} must be a non-empty string.`);
}

function parsePositiveInteger(value: unknown, pathName: string) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  throw new Error(`${pathName} must be a positive integer.`);
}

function parseNonNegativeNumber(value: unknown, pathName: string) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  throw new Error(`${pathName} must be a non-negative number.`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDeductionPolicy(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
