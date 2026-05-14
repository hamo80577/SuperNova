import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStep,
  ApprovalStatus,
  AssignmentStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  Request,
  RequestStatus,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import { AuditService } from "../../audit/audit.service";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateTransferRequestDto } from "../dto/create-transfer-request.dto";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import {
  RequestApprovalRoutingService,
  type GeneratedApprovalStep
} from "../request-approval-routing.service";
import { toRequestSummary } from "../request-response.utils";
import { assertRequestTransition } from "../request-status-machine";

const requestInclude = {
  createdBy: true,
  targetUser: true,
  sourceChain: true,
  sourceVendor: { include: { chain: true } },
  destinationChain: true,
  destinationVendor: { include: { chain: true } },
  approvals: {
    include: { approver: true },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.RequestInclude;

type TransferApprovalWithRequest = Prisma.RequestApprovalGetPayload<{
  include: {
    request: {
      include: typeof requestInclude;
    };
  };
}>;

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type TransferPayload = {
  transfer: {
    reason: string;
    notes?: string;
    requestedTransferDate?: string;
    approvalPath: "SAME_CHAIN" | "CROSS_CHAIN";
  };
  source: {
    vendorId: string;
    chainId: string;
    pickerAssignmentId: string;
  };
  destination: {
    vendorId: string;
    chainId: string;
  };
  target: {
    pickerId: string;
  };
  finalization?: {
    completedAt: string;
    oldAssignmentId: string;
    newAssignmentId: string;
    appliedByApprovalId: string;
  };
};

@Injectable()
export class TransferWorkflowService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestApprovalRoutingService)
    private readonly requestApprovalRoutingService: RequestApprovalRoutingService
  ) {}

  async createTransfer(dto: CreateTransferRequestDto, context: RequestContext) {
    const canSubmitTransfer =
      context.actor.role === UserRole.CHAMP ||
      context.actor.role === UserRole.AREA_MANAGER ||
      this.isAdmin(context.actor);

    if (!canSubmitTransfer) {
      throw new ForbiddenException(
        "Only Champs, Area Managers, and Admins can submit Transfer requests."
      );
    }

    const transfer = this.normalizeTransferRequest(dto);

    if (dto.sourceVendorId === dto.destinationVendorId) {
      throw new BadRequestException(
        "Destination Branch must be different from the source Branch."
      );
    }

    const [
      sourcePickerAssignment,
      champSourceAssignment,
      areaManagerSourceAssignment,
      destinationVendor
    ] = await Promise.all([
      this.prisma.pickerBranchAssignment.findFirst({
        where: {
          pickerId: dto.targetUserId,
          vendorId: dto.sourceVendorId,
          status: AssignmentStatus.ACTIVE
        },
        include: {
          picker: true,
          vendor: {
            include: { chain: true }
          }
        }
      }),
      context.actor.role === UserRole.CHAMP
        ? this.prisma.vendorChampAssignment.findFirst({
            where: {
              champId: context.actor.id,
              vendorId: dto.sourceVendorId,
              status: AssignmentStatus.ACTIVE
            }
          })
        : null,
      context.actor.role === UserRole.AREA_MANAGER
        ? this.prisma.chainAreaManagerAssignment.findFirst({
            where: {
              areaManagerId: context.actor.id,
              chain: {
                vendors: {
                  some: { id: dto.sourceVendorId }
                }
              },
              status: AssignmentStatus.ACTIVE
            }
          })
        : null,
      this.prisma.vendor.findUnique({
        where: { id: dto.destinationVendorId },
        include: { chain: true }
      })
    ]);

    if (!sourcePickerAssignment) {
      throw new ForbiddenException(
        this.isAdmin(context.actor)
          ? "Selected Picker is not actively assigned to the source Branch."
          : context.actor.role === UserRole.AREA_MANAGER
            ? "Selected Picker is not actively assigned to a Branch in your Chain scope."
            : "You can submit Transfer requests only from assigned active Branches."
      );
    }

    if (context.actor.role === UserRole.CHAMP && !champSourceAssignment) {
      throw new ForbiddenException(
        "You can submit Transfer requests only from Branches you currently manage."
      );
    }

    if (
      context.actor.role === UserRole.AREA_MANAGER &&
      !areaManagerSourceAssignment
    ) {
      throw new ForbiddenException(
        "Area Managers can transfer only Pickers from Chains they currently manage."
      );
    }

    if (sourcePickerAssignment.vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is not active.");
    }

    if (sourcePickerAssignment.vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Source Branch Chain is not active.");
    }

    if (
      sourcePickerAssignment.picker.role !== UserRole.PICKER ||
      sourcePickerAssignment.picker.accountStatus !== AccountStatus.ACTIVE ||
      sourcePickerAssignment.picker.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        "Selected user must be an active Picker under this Branch."
      );
    }

    if (!destinationVendor) {
      throw new NotFoundException("Destination Branch was not found.");
    }

    if (destinationVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch is not active.");
    }

    if (destinationVendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch Chain is not active.");
    }

    const duplicateTransfer = await this.prisma.request.findFirst({
      where: {
        type: RequestType.TRANSFER,
        targetUserId: sourcePickerAssignment.pickerId,
        status: {
          notIn: [
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.COMPLETED
          ]
        }
      }
    });

    if (duplicateTransfer) {
      throw new ConflictException(
        "A pending Transfer request already exists for this Picker."
      );
    }

    const pendingOffboarding = await this.prisma.request.findFirst({
      where: {
        type: RequestType.RESIGNATION,
        targetUserId: sourcePickerAssignment.pickerId,
        status: {
          notIn: [
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.COMPLETED
          ]
        }
      }
    });

    if (pendingOffboarding) {
      throw new ConflictException(
        "A pending offboarding request already exists for this Picker."
      );
    }

    const sourceStep =
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
        sourcePickerAssignment.vendor.chainId
      );
    const isCrossChain =
      sourcePickerAssignment.vendor.chainId !== destinationVendor.chainId;
    const destinationStep = isCrossChain
      ? await this.requestApprovalRoutingService.resolveAreaManagerStep(
          ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
          destinationVendor.chainId
        )
      : null;

    const payload: TransferPayload = {
      transfer: {
        ...transfer,
        approvalPath: isCrossChain ? "CROSS_CHAIN" : "SAME_CHAIN"
      },
      source: {
        vendorId: sourcePickerAssignment.vendorId,
        chainId: sourcePickerAssignment.vendor.chainId,
        pickerAssignmentId: sourcePickerAssignment.id
      },
      destination: {
        vendorId: destinationVendor.id,
        chainId: destinationVendor.chainId
      },
      target: {
        pickerId: sourcePickerAssignment.pickerId
      }
    };

    assertRequestPayloadSafe(payload as unknown as Record<string, unknown>);

    const steps = destinationStep ? [sourceStep, destinationStep] : [sourceStep];
    const shouldAutoApproveSource =
      context.actor.role === UserRole.AREA_MANAGER &&
      sourceStep.approverId === context.actor.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.TRANSFER,
          status: RequestStatus.PENDING_AREA_MANAGER,
          currentStep: ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
          createdById: context.actor.id,
          targetUserId: sourcePickerAssignment.pickerId,
          sourceVendorId: sourcePickerAssignment.vendorId,
          sourceChainId: sourcePickerAssignment.vendor.chainId,
          destinationVendorId: destinationVendor.id,
          destinationChainId: destinationVendor.chainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: steps.map((step) => ({
          requestId: request.id,
          step: step.step,
          approverRole: step.approverRole,
          approverId: step.approverId,
          status: ApprovalStatus.PENDING
        }))
      });

      await tx.auditLog.createMany({
        data: [
          {
            actorUserId: context.actor.id,
            action: "REQUEST_CREATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              id: request.id,
              type: request.type,
              targetUserId: request.targetUserId,
              sourceVendorId: request.sourceVendorId,
              destinationVendorId: request.destinationVendorId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_SUBMITTED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              id: request.id,
              status: request.status,
              currentStep: request.currentStep
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          ...steps.map((step) => ({
            actorUserId: context.actor.id,
            action: "APPROVAL_GENERATED",
            entityType: "Request",
            entityId: request.id,
            newValue: {
              step: step.step,
              approverRole: step.approverRole,
              approverId: step.approverId,
              chainId: step.chainId ?? null
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }))
        ]
      });

      await tx.notification.create({
        data: {
          userId: context.actor.id,
          type: "REQUEST_SUBMITTED",
          title: "Transfer request submitted",
          body: shouldAutoApproveSource
            ? `Transfer request for ${sourcePickerAssignment.picker.nameEn} was submitted and source approval was applied.`
            : `Transfer request for ${sourcePickerAssignment.picker.nameEn} was submitted for source Area Manager approval.`,
          payload: {
            requestId: request.id,
            pickerId: sourcePickerAssignment.pickerId,
            sourceVendorId: sourcePickerAssignment.vendorId,
            destinationVendorId: destinationVendor.id
          }
        }
      });

      if (sourceStep.approverId && !shouldAutoApproveSource) {
        await tx.notification.create({
          data: {
            userId: sourceStep.approverId,
            type: "APPROVAL_PENDING",
            title: "Transfer approval pending",
            body: `Transfer request from ${sourcePickerAssignment.vendor.vendorName} requires your approval.`,
            payload: {
              requestId: request.id,
              step: sourceStep.step,
              pickerId: sourcePickerAssignment.pickerId
            }
          }
        });
      }

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    if (shouldAutoApproveSource) {
      const sourceApproval = updated.approvals.find(
        (approval) => approval.step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
      );

      if (!sourceApproval) {
        throw new BadRequestException("Source Area Manager approval was not created.");
      }

      return this.approveTransferApproval(
        sourceApproval.id,
        "Source Area Manager initiated and auto-approved this Transfer.",
        context,
        { suppressIntermediateCreatorNotification: true }
      );
    }

    return toRequestSummary(updated);
  }

  async approveTransferApproval(
    approvalId: string,
    notes: string | undefined,
    context: RequestContext,
    options: { suppressIntermediateCreatorNotification?: boolean } = {}
  ) {
    const approval = await this.prisma.requestApproval.findUnique({
      where: { id: approvalId },
      include: {
        request: {
          include: requestInclude
        }
      }
    });

    if (!approval) {
      throw new NotFoundException("Approval was not found.");
    }

    if (approval.request.type !== RequestType.TRANSFER) {
      throw new BadRequestException("Only Transfer approvals can be applied here.");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException("Only PENDING approvals can be decided.");
    }

    const expectedStatus = this.statusForStep(approval.step);
    if (
      approval.request.status !== expectedStatus ||
      approval.request.currentStep !== approval.step
    ) {
      throw new BadRequestException(
        "Approval is not the current pending step for this request."
      );
    }

    const canAct = await this.userCanActOnStep(
      approval.request,
      approval.step,
      approval.approverId,
      context.actor
    );

    if (!canAct) {
      throw new ForbiddenException("You do not own this approval step.");
    }

    const pendingApprovals = this.sortApprovals(
      approval.request.approvals.filter(
        (item) => item.status === ApprovalStatus.PENDING && item.id !== approval.id
      )
    );
    const nextApproval = pendingApprovals[0] ?? null;

    if (nextApproval) {
      const nextStatus = this.statusForStep(nextApproval.step);
      assertRequestTransition(approval.request.status, nextStatus);

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.requestApproval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.APPROVED,
            decisionAt: new Date(),
            notes,
            approverId: approval.approverId ?? context.actor.id
          }
        });

        const updatedRequest = await tx.request.update({
          where: { id: approval.requestId },
          data: {
            status: nextStatus,
            currentStep: nextApproval.step
          },
          include: requestInclude
        });

        if (nextApproval.approverId) {
          await tx.notification.create({
            data: {
              userId: nextApproval.approverId,
              type: "APPROVAL_PENDING",
              title: "Destination Transfer approval pending",
              body: "A cross-chain Transfer request requires your destination Chain approval.",
              payload: {
                requestId: approval.requestId,
                approvalId: nextApproval.id,
                step: nextApproval.step
              }
            }
          });
        }

        return updatedRequest;
      });

      await this.auditService.log({
        actorUserId: context.actor.id,
        action: "APPROVAL_APPROVED",
        entityType: "RequestApproval",
        entityId: approval.id,
        oldValue: {
          id: approval.id,
          requestId: approval.requestId,
          step: approval.step,
          status: approval.status
        },
        newValue: {
          id: approval.id,
          requestId: approval.requestId,
          step: approval.step,
          status: ApprovalStatus.APPROVED,
          notes: notes ?? null
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      if (!options.suppressIntermediateCreatorNotification) {
        await this.notificationsService.create({
          userId: approval.request.createdById,
          type: "APPROVAL_APPROVED",
          title: "Source Transfer approval completed",
          body: "The source Chain Area Manager approved the Transfer request. Destination approval is now pending.",
          payload: { requestId: approval.requestId, approvalId: approval.id }
        });
      }

      return toRequestSummary(updated);
    }

    return this.applyTransferAfterFinalApproval(approval, notes, context);
  }

  async generateApprovalStepsForRequest(
    request: Pick<Request, "sourceChainId" | "destinationChainId">
  ): Promise<GeneratedApprovalStep[]> {
    if (!request.sourceChainId || !request.destinationChainId) {
      throw new BadRequestException(
        "Transfer requests require source and destination Chain context."
      );
    }

    const sourceStep =
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL,
        request.sourceChainId
      );

    if (request.sourceChainId === request.destinationChainId) {
      return [sourceStep];
    }

    return [
      sourceStep,
      await this.requestApprovalRoutingService.resolveAreaManagerStep(
        ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL,
        request.destinationChainId
      )
    ];
  }

  private async applyTransferAfterFinalApproval(
    approval: TransferApprovalWithRequest,
    notes: string | undefined,
    context: RequestContext
  ) {
    const payload = this.parseTransferPayload(approval.request.payload);

    if (approval.request.targetUserId !== payload.target.pickerId) {
      throw new BadRequestException(
        "Request target Picker does not match the stored Transfer payload."
      );
    }

    if (
      approval.request.sourceVendorId !== payload.source.vendorId ||
      approval.request.sourceChainId !== payload.source.chainId ||
      approval.request.destinationVendorId !== payload.destination.vendorId ||
      approval.request.destinationChainId !== payload.destination.chainId
    ) {
      throw new BadRequestException(
        "Transfer request context does not match the stored payload."
      );
    }

    const [targetPicker, sourceVendor, destinationVendor, activeAssignment] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: payload.target.pickerId } }),
        this.prisma.vendor.findUnique({
          where: { id: payload.source.vendorId },
          include: { chain: true }
        }),
        this.prisma.vendor.findUnique({
          where: { id: payload.destination.vendorId },
          include: { chain: true }
        }),
        this.prisma.pickerBranchAssignment.findFirst({
          where: {
            id: payload.source.pickerAssignmentId,
            pickerId: payload.target.pickerId,
            vendorId: payload.source.vendorId,
            status: AssignmentStatus.ACTIVE
          }
        })
      ]);

    if (!targetPicker) {
      throw new NotFoundException("Target Picker was not found.");
    }

    if (
      targetPicker.role !== UserRole.PICKER ||
      targetPicker.accountStatus !== AccountStatus.ACTIVE ||
      targetPicker.employmentStatus !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException("Target Picker is no longer active.");
    }

    if (!sourceVendor) {
      throw new NotFoundException("Source Branch was not found.");
    }

    if (!destinationVendor) {
      throw new NotFoundException("Destination Branch was not found.");
    }

    if (sourceVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Source Branch is no longer active.");
    }

    if (destinationVendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Destination Branch is no longer active.");
    }

    if (
      sourceVendor.chainId !== payload.source.chainId ||
      destinationVendor.chainId !== payload.destination.chainId
    ) {
      throw new BadRequestException(
        "Source or destination Branch no longer matches the stored Chain context."
      );
    }

    if (!activeAssignment) {
      throw new BadRequestException(
        "Target Picker no longer has an active assignment to the source Branch."
      );
    }

    const completedAt = new Date();
    assertRequestTransition(approval.request.status, RequestStatus.COMPLETED);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.APPROVED,
          decisionAt: completedAt,
          notes,
          approverId: approval.approverId ?? context.actor.id
        }
      });

      const closedAssignment = await tx.pickerBranchAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: completedAt
        },
        include: {
          picker: true,
          vendor: { include: { chain: true } }
        }
      });

      const newAssignment = await tx.pickerBranchAssignment.create({
        data: {
          pickerId: payload.target.pickerId,
          vendorId: payload.destination.vendorId,
          status: AssignmentStatus.ACTIVE,
          startDate: completedAt,
          createdByRequestId: approval.requestId
        },
        include: {
          picker: true,
          vendor: { include: { chain: true } }
        }
      });

      const completedPayload: TransferPayload = {
        ...payload,
        finalization: {
          completedAt: completedAt.toISOString(),
          oldAssignmentId: closedAssignment.id,
          newAssignmentId: newAssignment.id,
          appliedByApprovalId: approval.id
        }
      };

      const completedRequest = await tx.request.update({
        where: { id: approval.requestId },
        data: {
          status: RequestStatus.COMPLETED,
          currentStep: null,
          completedAt,
          payload: completedPayload as Prisma.InputJsonValue
        },
        include: requestInclude
      });

      const [sourceChampAssignment, destinationChampAssignment] = await Promise.all([
        tx.vendorChampAssignment.findFirst({
          where: {
            vendorId: sourceVendor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { champId: true }
        }),
        tx.vendorChampAssignment.findFirst({
          where: {
            vendorId: destinationVendor.id,
            status: AssignmentStatus.ACTIVE
          },
          select: { champId: true }
        })
      ]);

      const notifications = new Map<
        string,
        {
          type: string;
          title: string;
          body: string;
          payload: Prisma.InputJsonValue;
        }
      >();
      const addNotification = (
        userId: string | null | undefined,
        notification: {
          type: string;
          title: string;
          body: string;
          payload: Prisma.InputJsonValue;
        }
      ) => {
        if (userId && !notifications.has(userId)) {
          notifications.set(userId, notification);
        }
      };

      addNotification(approval.request.createdById, {
        type: "TRANSFER_COMPLETED",
        title: "Transfer completed",
        body: `${targetPicker.nameEn} was transferred from ${sourceVendor.vendorName} to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          oldAssignmentId: closedAssignment.id,
          newAssignmentId: newAssignment.id
        }
      });
      addNotification(targetPicker.id, {
        type: "TRANSFER_COMPLETED",
        title: "Branch transfer completed",
        body: `Your active Branch is now ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          vendorId: destinationVendor.id,
          chainId: destinationVendor.chainId
        }
      });
      addNotification(sourceChampAssignment?.champId, {
        type: "TRANSFER_COMPLETED",
        title: "Picker transferred out",
        body: `${targetPicker.nameEn} was transferred from ${sourceVendor.vendorName} to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          vendorId: sourceVendor.id,
          oldAssignmentId: closedAssignment.id
        }
      });
      addNotification(destinationChampAssignment?.champId, {
        type: "TRANSFER_COMPLETED",
        title: "Picker transferred in",
        body: `${targetPicker.nameEn} was transferred to ${destinationVendor.vendorName}.`,
        payload: {
          requestId: approval.requestId,
          pickerId: targetPicker.id,
          vendorId: destinationVendor.id,
          newAssignmentId: newAssignment.id
        }
      });

      for (const [userId, notification] of notifications) {
        await tx.notification.create({
          data: {
            userId,
            ...notification
          }
        });
      }

      await tx.auditLog.createMany({
        data: [
          {
            actorUserId: context.actor.id,
            action: "APPROVAL_APPROVED",
            entityType: "RequestApproval",
            entityId: approval.id,
            oldValue: {
              status: approval.status,
              step: approval.step,
              requestId: approval.requestId
            },
            newValue: {
              status: ApprovalStatus.APPROVED,
              step: approval.step,
              requestId: approval.requestId,
              notes: notes ?? null
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "TRANSFER_APPLIED",
            entityType: "Request",
            entityId: approval.requestId,
            oldValue: {
              status: approval.request.status,
              currentStep: approval.request.currentStep,
              sourceVendorId: payload.source.vendorId,
              destinationVendorId: payload.destination.vendorId
            },
            newValue: {
              status: RequestStatus.COMPLETED,
              oldAssignmentId: closedAssignment.id,
              newAssignmentId: newAssignment.id
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_BRANCH_ASSIGNMENT_CLOSED",
            entityType: "PickerBranchAssignment",
            entityId: closedAssignment.id,
            oldValue: {
              pickerId: closedAssignment.pickerId,
              vendorId: closedAssignment.vendorId,
              status: AssignmentStatus.ACTIVE
            },
            newValue: {
              pickerId: closedAssignment.pickerId,
              vendorId: closedAssignment.vendorId,
              status: AssignmentStatus.CLOSED,
              endDate: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "PICKER_BRANCH_ASSIGNMENT_CREATED",
            entityType: "PickerBranchAssignment",
            entityId: newAssignment.id,
            newValue: {
              pickerId: newAssignment.pickerId,
              vendorId: newAssignment.vendorId,
              createdByRequestId: approval.requestId
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          },
          {
            actorUserId: context.actor.id,
            action: "REQUEST_COMPLETED",
            entityType: "Request",
            entityId: approval.requestId,
            oldValue: { status: approval.request.status },
            newValue: {
              status: RequestStatus.COMPLETED,
              completedAt: completedAt.toISOString()
            },
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        ]
      });

      return { completedRequest, closedAssignment, newAssignment };
    });

    return toRequestSummary(result.completedRequest);
  }

  private normalizeTransferRequest(
    dto: CreateTransferRequestDto
  ): Omit<TransferPayload["transfer"], "approvalPath"> {
    const reason = dto.reason?.trim();
    const notes = dto.notes?.trim();

    if (!reason) {
      throw new BadRequestException("Transfer reason is required.");
    }

    return {
      reason,
      ...(notes ? { notes } : {}),
      ...(dto.requestedTransferDate
        ? { requestedTransferDate: dto.requestedTransferDate }
        : {})
    };
  }

  private parseTransferPayload(payload: Prisma.JsonValue): TransferPayload {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Transfer request payload is invalid.");
    }

    const objectPayload = payload as Record<string, unknown>;
    const transfer = objectPayload.transfer;
    const source = objectPayload.source;
    const destination = objectPayload.destination;
    const target = objectPayload.target;

    if (
      !transfer ||
      typeof transfer !== "object" ||
      Array.isArray(transfer) ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      !destination ||
      typeof destination !== "object" ||
      Array.isArray(destination) ||
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      throw new BadRequestException("Transfer request payload is incomplete.");
    }

    const transferPayload = transfer as Record<string, unknown>;
    const sourcePayload = source as Record<string, unknown>;
    const destinationPayload = destination as Record<string, unknown>;
    const targetPayload = target as Record<string, unknown>;
    const reason = transferPayload.reason;
    const approvalPath = transferPayload.approvalPath;
    const sourceVendorId = sourcePayload.vendorId;
    const sourceChainId = sourcePayload.chainId;
    const pickerAssignmentId = sourcePayload.pickerAssignmentId;
    const destinationVendorId = destinationPayload.vendorId;
    const destinationChainId = destinationPayload.chainId;
    const pickerId = targetPayload.pickerId;

    if (
      typeof reason !== "string" ||
      (approvalPath !== "SAME_CHAIN" && approvalPath !== "CROSS_CHAIN") ||
      typeof sourceVendorId !== "string" ||
      typeof sourceChainId !== "string" ||
      typeof pickerAssignmentId !== "string" ||
      typeof destinationVendorId !== "string" ||
      typeof destinationChainId !== "string" ||
      typeof pickerId !== "string"
    ) {
      throw new BadRequestException(
        "Transfer request payload is missing required context."
      );
    }

    return {
      transfer: {
        reason,
        approvalPath,
        notes:
          typeof transferPayload.notes === "string"
            ? transferPayload.notes
            : undefined,
        requestedTransferDate:
          typeof transferPayload.requestedTransferDate === "string"
            ? transferPayload.requestedTransferDate
            : undefined
      },
      source: {
        vendorId: sourceVendorId,
        chainId: sourceChainId,
        pickerAssignmentId
      },
      destination: {
        vendorId: destinationVendorId,
        chainId: destinationChainId
      },
      target: {
        pickerId
      },
      finalization:
        objectPayload.finalization &&
        typeof objectPayload.finalization === "object" &&
        !Array.isArray(objectPayload.finalization)
          ? (objectPayload.finalization as TransferPayload["finalization"])
          : undefined
    };
  }

  private async userCanActOnStep(
    request: Pick<Request, "sourceChainId" | "destinationChainId">,
    step: ApprovalStep,
    approverId: string | null,
    user: AuthenticatedUser
  ) {
    if (approverId && approverId !== user.id) {
      return false;
    }

    return this.userCouldOwnApproval(request, step, approverId, user);
  }

  private async userCouldOwnApproval(
    request: Pick<Request, "sourceChainId" | "destinationChainId">,
    step: ApprovalStep,
    approverId: string | null,
    user: AuthenticatedUser
  ) {
    if (step === ApprovalStep.ADMIN_FINAL_APPROVAL) {
      return this.isAdmin(user);
    }

    if (user.role !== UserRole.AREA_MANAGER) {
      return false;
    }

    if (approverId && approverId === user.id) {
      return true;
    }

    const chainId =
      step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL
        ? request.destinationChainId
        : request.sourceChainId;

    if (!chainId) {
      return false;
    }

    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: {
        chainId,
        areaManagerId: user.id,
        status: AssignmentStatus.ACTIVE
      }
    });

    return Boolean(assignment);
  }

  private statusForStep(step: ApprovalStep) {
    if (
      step === ApprovalStep.AREA_MANAGER_APPROVAL ||
      step === ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL
    ) {
      return RequestStatus.PENDING_AREA_MANAGER;
    }

    if (step === ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL) {
      return RequestStatus.PENDING_DESTINATION_AREA_MANAGER;
    }

    return RequestStatus.PENDING_ADMIN;
  }

  private sortApprovals<T extends { step: ApprovalStep; createdAt: Date }>(
    approvals: T[]
  ) {
    const priority: Record<ApprovalStep, number> = {
      [ApprovalStep.AREA_MANAGER_APPROVAL]: 1,
      [ApprovalStep.SOURCE_AREA_MANAGER_APPROVAL]: 1,
      [ApprovalStep.DESTINATION_AREA_MANAGER_APPROVAL]: 2,
      [ApprovalStep.ADMIN_FINAL_APPROVAL]: 3
    };

    return [...approvals].sort((left, right) => {
      const byPriority = priority[left.step] - priority[right.step];
      return byPriority || left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  private isAdmin(user: AuthenticatedUser) {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }
}
