import {
  DeductionPenaltyType,
  DeductionPolicyStatus,
  PrismaClient,
  UserRole
} from "@prisma/client";

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

const days = (
  occurrenceNumber: number,
  value: number,
  appliesFromOccurrence?: number
): RuleSeed => ({
  occurrenceNumber,
  ...(appliesFromOccurrence ? { appliesFromOccurrence } : {}),
  penaltyType: DeductionPenaltyType.DEDUCTION_DAYS,
  deductionDays: value,
  label: value === 1 ? "1 day" : `${value} day${value > 1 ? "s" : ""}`
});

const review = (
  occurrenceNumber: number,
  appliesFromOccurrence?: number
): RuleSeed => ({
  occurrenceNumber,
  ...(appliesFromOccurrence ? { appliesFromOccurrence } : {}),
  penaltyType: DeductionPenaltyType.LIFECYCLE_REVIEW_REQUIRED,
  label: "Lifecycle review required"
});

const POLICY_ACTIONS: ActionSeed[] = [
  {
    code: "ATTITUDE",
    name: "Attitude",
    description: "Attitude and behavior violations.",
    rules: [days(1, 0.5), days(2, 1), review(3)]
  },
  {
    code: "UNIFORM",
    name: "Uniform",
    description: "Uniform compliance violations.",
    rules: [days(1, 0.25), days(2, 0.5), days(3, 1), review(4)]
  },
  {
    code: "APPEARANCE",
    name: "Appearance",
    description: "Personal appearance violations.",
    rules: [days(1, 0.5), days(2, 1), days(3, 2), review(4)]
  },
  {
    code: "MANUAL_AVAILABILITY",
    name: "Manual Availability",
    description: "Manual availability misuse.",
    rules: [
      {
        occurrenceNumber: 1,
        penaltyType: DeductionPenaltyType.WARNING,
        label: "Warning"
      },
      days(2, 0.25),
      days(3, 0.5),
      days(4, 1),
      days(5, 2, 5)
    ]
  },
  {
    code: "ABSENT_WITHOUT_PERMISSION",
    name: "Absent without Permission",
    description: "Absence without prior permission.",
    rules: [days(1, 1), days(2, 2), days(3, 3), days(4, 3), review(5, 5)]
  },
  {
    code: "PREPARED_ORDERS_NOT_SIGNED",
    name: "Prepared Orders not signed/known",
    description: "Prepared orders left unsigned or unaccounted for.",
    rules: [days(1, 1, 1)]
  },
  {
    code: "CHECKIN_FACE_NOT_VISIBLE",
    name: "Check-in Face Not Visible",
    description: "Check-in photo does not show the face clearly.",
    rules: [days(1, 0.1), days(2, 0.25), days(3, 0.5), days(4, 0.75), days(5, 1, 5)]
  }
];

export async function seedDeductionPolicy(prisma: PrismaClient) {
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
      versionNumber: 1,
      status: DeductionPolicyStatus.ACTIVE,
      effectiveFrom: new Date(),
      createdById: adminUser.id,
      actions: {
        create: POLICY_ACTIONS.map((action) => ({
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
    `Seeded Deduction policy version ${policy.versionNumber} with ${POLICY_ACTIONS.length} actions.`
  );
  return policy;
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
