import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  DeductionActionStatus,
  DeductionPolicyStatus,
  type DeductionRuleStep,
  type Prisma
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateDeductionActionDto,
  DeductionRuleStepInputDto,
  UpdateDeductionActionDto
} from "./dto/manage-policy.dto";
import type {
  DeductionRequestContext,
  DeductionRuleMatch
} from "./deductions.types";

const activePolicyInclude = {
  actions: {
    where: { status: DeductionActionStatus.ACTIVE },
    orderBy: { name: "asc" },
    include: {
      ruleSteps: { orderBy: { occurrenceNumber: "asc" } }
    }
  }
} satisfies Prisma.DeductionPolicyVersionInclude;

const allActionsPolicyInclude = {
  actions: {
    orderBy: { name: "asc" },
    include: {
      ruleSteps: { orderBy: { occurrenceNumber: "asc" } }
    }
  }
} satisfies Prisma.DeductionPolicyVersionInclude;

export type ActiveDeductionPolicy = Prisma.DeductionPolicyVersionGetPayload<{
  include: typeof activePolicyInclude;
}>;

@Injectable()
export class DeductionPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getActivePolicy(
    options: { includeInactiveActions?: boolean } = {}
  ): Promise<ActiveDeductionPolicy> {
    const policy = await this.prisma.deductionPolicyVersion.findFirst({
      where: { status: DeductionPolicyStatus.ACTIVE },
      orderBy: { versionNumber: "desc" },
      include: options.includeInactiveActions
        ? allActionsPolicyInclude
        : activePolicyInclude
    });

    if (!policy) {
      throw new NotFoundException(
        "No active Deduction policy version exists. Seed or publish a policy first."
      );
    }

    return policy;
  }

  async getActiveAction(actionId: string) {
    const policy = await this.getActivePolicy();
    const action = policy.actions.find((item) => item.id === actionId);

    if (!action) {
      throw new BadRequestException(
        "actionId does not belong to an active action in the active policy version."
      );
    }

    return { policy, action };
  }

  async createAction(
    dto: CreateDeductionActionDto,
    context: DeductionRequestContext
  ) {
    const policy = await this.getActivePolicy();
    const code = dto.code.trim().toUpperCase();

    const duplicate = await this.prisma.deductionAction.findFirst({
      where: { policyVersionId: policy.id, code },
      select: { id: true }
    });
    if (duplicate) {
      throw new ConflictException(
        "An action with this code already exists in the active policy."
      );
    }

    assertRuleStepsConsistent(dto.ruleSteps);

    const action = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deductionAction.create({
        data: {
          policyVersionId: policy.id,
          code,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          ruleSteps: {
            create: dto.ruleSteps.map(toRuleStepCreate)
          }
        },
        include: { ruleSteps: { orderBy: { occurrenceNumber: "asc" } } }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actor.id,
          action: "DEDUCTION_POLICY_ACTION_CREATED",
          entityType: "DeductionAction",
          entityId: created.id,
          newValue: {
            code: created.code,
            name: created.name,
            ruleSteps: dto.ruleSteps
          } as unknown as Prisma.InputJsonValue,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return created;
    });

    return action;
  }

  async updateAction(
    actionId: string,
    dto: UpdateDeductionActionDto,
    context: DeductionRequestContext
  ) {
    const existing = await this.prisma.deductionAction.findUnique({
      where: { id: actionId },
      include: {
        policyVersion: { select: { status: true } },
        ruleSteps: { orderBy: { occurrenceNumber: "asc" } }
      }
    });

    if (!existing) {
      throw new NotFoundException("Deduction action was not found.");
    }

    if (existing.policyVersion.status !== DeductionPolicyStatus.ACTIVE) {
      throw new BadRequestException(
        "Only actions on the active policy version can be edited."
      );
    }

    if (dto.ruleSteps) {
      assertRuleStepsConsistent(dto.ruleSteps);
    }

    const action = await this.prisma.$transaction(async (tx) => {
      if (dto.ruleSteps) {
        await tx.deductionRuleStep.deleteMany({ where: { actionId } });
        await tx.deductionRuleStep.createMany({
          data: dto.ruleSteps.map((step) => ({
            actionId,
            ...toRuleStepCreate(step)
          }))
        });
      }

      const updated = await tx.deductionAction.update({
        where: { id: actionId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {})
        },
        include: { ruleSteps: { orderBy: { occurrenceNumber: "asc" } } }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actor.id,
          action: "DEDUCTION_POLICY_ACTION_UPDATED",
          entityType: "DeductionAction",
          entityId: actionId,
          oldValue: {
            name: existing.name,
            description: existing.description,
            status: existing.status,
            ruleSteps: existing.ruleSteps.map((step) => ({
              occurrenceNumber: step.occurrenceNumber,
              appliesFromOccurrence: step.appliesFromOccurrence,
              penaltyType: step.penaltyType,
              deductionDays:
                step.deductionDays === null ? null : Number(step.deductionDays),
              label: step.label
            }))
          } as Prisma.InputJsonValue,
          newValue: {
            name: updated.name,
            description: updated.description,
            status: updated.status,
            ...(dto.ruleSteps ? { ruleSteps: dto.ruleSteps } : {})
          } as unknown as Prisma.InputJsonValue,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return updated;
    });

    return action;
  }

  matchRuleStep(
    ruleSteps: DeductionRuleStep[],
    occurrenceNumber: number
  ): DeductionRuleMatch {
    const exact = ruleSteps.find(
      (step) =>
        step.appliesFromOccurrence === null &&
        step.occurrenceNumber === occurrenceNumber
    );

    const openEnded = ruleSteps
      .filter(
        (step) =>
          step.appliesFromOccurrence !== null &&
          occurrenceNumber >= step.appliesFromOccurrence
      )
      .sort(
        (a, b) =>
          (b.appliesFromOccurrence ?? 0) - (a.appliesFromOccurrence ?? 0)
      )[0];

    const highestRule = [...ruleSteps].sort(
      (a, b) => b.occurrenceNumber - a.occurrenceNumber
    )[0];
    const overflow =
      highestRule && occurrenceNumber > highestRule.occurrenceNumber
        ? highestRule
        : undefined;
    const matched = exact ?? openEnded ?? overflow;

    if (!matched) {
      throw new BadRequestException(
        `No deduction rule covers occurrence ${occurrenceNumber} for this action.`
      );
    }

    return {
      ruleStepId: matched.id,
      occurrenceNumber: matched.occurrenceNumber,
      appliesFromOccurrence: matched.appliesFromOccurrence,
      penaltyType: matched.penaltyType,
      deductionDays:
        matched.deductionDays === null ? null : Number(matched.deductionDays),
      label: matched.label
    };
  }
}

function toRuleStepCreate(step: DeductionRuleStepInputDto) {
  return {
    occurrenceNumber: step.occurrenceNumber,
    appliesFromOccurrence: step.appliesFromOccurrence ?? null,
    penaltyType: step.penaltyType,
    deductionDays: step.deductionDays ?? null,
    label: step.label.trim()
  };
}

function assertRuleStepsConsistent(ruleSteps: DeductionRuleStepInputDto[]) {
  const ordered = [...ruleSteps].sort(
    (a, b) => a.occurrenceNumber - b.occurrenceNumber
  );

  ordered.forEach((step, index) => {
    // Occurrence numbers must start at 1 and be contiguous so matchRuleStep
    // never hits a gap (which would leave an offense with no covering rule).
    const expected = index + 1;
    if (step.occurrenceNumber !== expected) {
      throw new BadRequestException(
        `Rule occurrences must start at 1 and be contiguous (expected ${expected}, got ${step.occurrenceNumber}).`
      );
    }

    if (
      step.appliesFromOccurrence !== undefined &&
      step.appliesFromOccurrence !== step.occurrenceNumber
    ) {
      throw new BadRequestException(
        "appliesFromOccurrence must equal occurrenceNumber for open-ended rules."
      );
    }

    // An open-ended rule covers "this occurrence and later", so it only makes
    // sense as the final rule; otherwise later explicit rules become dead.
    if (
      step.appliesFromOccurrence !== undefined &&
      index !== ordered.length - 1
    ) {
      throw new BadRequestException(
        "Only the last (highest) rule can apply to all later occurrences."
      );
    }

    if (
      step.penaltyType === "DEDUCTION_DAYS" &&
      (step.deductionDays === undefined || step.deductionDays <= 0)
    ) {
      throw new BadRequestException(
        `deductionDays is required for occurrence ${step.occurrenceNumber}.`
      );
    }
  });
}
