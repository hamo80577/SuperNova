import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  AttendanceImportBatchStatus,
  Prisma,
  RequestStatus,
  RequestType,
  UserRole
} from "@prisma/client";

import { AuditService } from "../../audit/audit.service";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AnnualLeaveBalanceService,
  type AnnualLeaveBalance
} from "../../users/annual-leave-balance.service";
import { RequestApprovalRoutingService } from "../request-approval-routing.service";
import { requestInclude } from "../request-includes";
import { assertRequestPayloadSafe } from "../request-payload.utils";
import { toRequestSummary } from "../request-response.utils";
import type { CreateAnnualLeaveRequestDto } from "../dto/create-annual-leave-request.dto";

type RequestContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Request statuses that "hold" balance for a user. DRAFT/REJECTED/CANCELLED/
// COMPLETED do not reserve days; APPROVED still does until it converts into
// posted attendance.
const ACTIVE_HOLD_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING_CHAMP,
  RequestStatus.PENDING_AREA_MANAGER,
  RequestStatus.PENDING_ADMIN,
  RequestStatus.APPROVED
];

interface LeaveContext {
  vendorId: string;
  chainId: string;
}

interface ComputedRequest {
  startDate: string;
  endDate: string;
  startDateUtc: Date;
  endDateUtc: Date;
  requestedDays: number;
  reason: string;
}

interface HoldComputation {
  officialRemainingDays: number;
  heldDays: number;
  availableToRequest: number;
}

interface InitialApprovalNotificationTarget {
  step: ApprovalStep;
  approverId: string | null;
}

export interface AnnualLeavePreviewResult {
  requestedDays: number;
  officialRemainingDays: number;
  heldDays: number;
  availableToRequestDays: number;
  availableAfterRequestDays: number;
  eligibilityStatus: AnnualLeaveBalance["eligibilityStatus"];
  eligibleFrom: string | null;
  blockingReasons: string[];
}

export interface AnnualLeaveAvailabilityResult {
  officialRemainingDays: number;
  heldDays: number;
  availableToRequestDays: number;
  eligibilityStatus: AnnualLeaveBalance["eligibilityStatus"];
  eligibleFrom: string | null;
  message: string;
}

@Injectable()
export class AnnualLeaveRequestService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AnnualLeaveBalanceService)
    private readonly balanceService: AnnualLeaveBalanceService,
    @Inject(RequestApprovalRoutingService)
    private readonly approvalRoutingService: RequestApprovalRoutingService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService
  ) {}

  async preview(
    actor: AuthenticatedUser,
    dto: CreateAnnualLeaveRequestDto
  ): Promise<AnnualLeavePreviewResult> {
    this.assertSelfRequestRole(actor);

    const asOf = new Date();
    const balance = await this.loadBalance(actor, asOf);
    const blockingReasons: string[] = [];

    // Preview must never throw on bad input — invalid dates become a blocking
    // reason instead of a thrown BadRequestException.
    let computed: ComputedRequest | null = null;
    try {
      computed = this.computeRequest(dto);
    } catch (error) {
      blockingReasons.push(
        error instanceof BadRequestException
          ? this.errorMessage(error)
          : "Annual leave request dates are invalid."
      );
    }

    if (balance.eligibilityStatus !== "ELIGIBLE") {
      blockingReasons.push(this.eligibilityMessage(balance));
    }

    if (
      computed &&
      computed.startDateUtc.getTime() > computed.endDateUtc.getTime()
    ) {
      blockingReasons.push("Start date must be on or before the end date.");
    }

    if (computed && !computed.reason) {
      blockingReasons.push("A reason is required for an annual leave request.");
    }

    if (computed) {
      const yearViolation = this.currentYearViolation(computed, asOf);
      if (yearViolation) {
        blockingReasons.push(yearViolation);
      }
    }

    try {
      await this.resolveContext(actor, dto);
    } catch (error) {
      blockingReasons.push(
        error instanceof BadRequestException
          ? this.errorMessage(error)
          : "Unable to resolve the branch context for this request."
      );
    }

    const hold = await this.computeHold(actor.id, balance, asOf, null);
    const requestedDays = computed?.requestedDays ?? 0;

    if (computed && requestedDays > hold.availableToRequest) {
      blockingReasons.push(
        `Requested days (${requestedDays}) exceed the available balance (${hold.availableToRequest}).`
      );
    }

    if (
      computed &&
      (await this.hasOverlappingActiveRequest(actor.id, computed, null))
    ) {
      blockingReasons.push(
        "An overlapping annual leave request already exists for these dates."
      );
    }

    return {
      requestedDays,
      officialRemainingDays: hold.officialRemainingDays,
      heldDays: hold.heldDays,
      availableToRequestDays: hold.availableToRequest,
      availableAfterRequestDays: hold.availableToRequest - requestedDays,
      eligibilityStatus: balance.eligibilityStatus,
      eligibleFrom: balance.eligibleFrom,
      blockingReasons
    };
  }

  async availability(
    actor: AuthenticatedUser
  ): Promise<AnnualLeaveAvailabilityResult> {
    this.assertSelfRequestRole(actor);

    const asOf = new Date();
    const balance = await this.loadBalance(actor, asOf);
    const hold = await this.computeHold(actor.id, balance, asOf, null);

    return {
      officialRemainingDays: hold.officialRemainingDays,
      heldDays: hold.heldDays,
      availableToRequestDays: hold.availableToRequest,
      eligibilityStatus: balance.eligibilityStatus,
      eligibleFrom: balance.eligibleFrom,
      message:
        balance.eligibilityStatus === "ELIGIBLE"
          ? balance.message
          : this.eligibilityMessage(balance)
    };
  }

  async createSelfRequest(
    actor: AuthenticatedUser,
    dto: CreateAnnualLeaveRequestDto,
    context: RequestContext
  ) {
    this.assertSelfRequestRole(actor);

    const asOf = new Date();
    const balance = await this.loadBalance(actor, asOf);

    if (balance.eligibilityStatus !== "ELIGIBLE") {
      throw new ForbiddenException(this.eligibilityMessage(balance));
    }

    const computed = this.computeRequest(dto);

    if (computed.startDateUtc.getTime() > computed.endDateUtc.getTime()) {
      throw new BadRequestException(
        "Start date must be on or before the end date."
      );
    }

    if (!computed.reason) {
      throw new BadRequestException(
        "A reason is required for an annual leave request."
      );
    }

    const yearViolation = this.currentYearViolation(computed, asOf);
    if (yearViolation) {
      throw new BadRequestException(yearViolation);
    }

    const leaveContext = await this.resolveContext(actor, dto);

    const hold = await this.computeHold(actor.id, balance, asOf, null);

    if (computed.requestedDays > hold.availableToRequest) {
      throw new BadRequestException(
        `Requested days (${computed.requestedDays}) exceed the available balance (${hold.availableToRequest}).`
      );
    }

    if (await this.hasOverlappingActiveRequest(actor.id, computed, null)) {
      throw new BadRequestException(
        "An overlapping annual leave request already exists for these dates."
      );
    }

    const steps = this.buildApprovalSteps(actor.role);
    const champStep =
      actor.role === UserRole.PICKER
        ? await this.resolveChampStep(leaveContext.vendorId)
        : null;
    const areaManagerStep = await this.approvalRoutingService.resolveAreaManagerStep(
      ApprovalStep.AREA_MANAGER_APPROVAL,
      leaveContext.chainId
    );

    const resolvedSteps = steps.map((step) => {
      if (step === ApprovalStep.CHAMP_APPROVAL) {
        return {
          step,
          approverRole: UserRole.CHAMP,
          approverId: champStep!
        };
      }
      if (step === ApprovalStep.AREA_MANAGER_APPROVAL) {
        return {
          step,
          approverRole: UserRole.AREA_MANAGER,
          approverId: areaManagerStep.approverId
        };
      }
      return {
        step,
        approverRole: UserRole.ADMIN,
        approverId: null
      };
    });

    const initialStep = resolvedSteps[0].step;
    const initialStatus =
      initialStep === ApprovalStep.CHAMP_APPROVAL
        ? RequestStatus.PENDING_CHAMP
        : RequestStatus.PENDING_AREA_MANAGER;

    const payload = {
      startDate: computed.startDate,
      endDate: computed.endDate,
      reason: computed.reason
    };
    assertRequestPayloadSafe(payload);

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          type: RequestType.ANNUAL_LEAVE,
          status: initialStatus,
          currentStep: initialStep,
          createdById: actor.id,
          targetUserId: actor.id,
          sourceVendorId: leaveContext.vendorId,
          sourceChainId: leaveContext.chainId,
          payload: payload as Prisma.InputJsonValue
        }
      });

      await tx.requestApproval.createMany({
        data: resolvedSteps.map((step) => ({
          requestId: request.id,
          step: step.step,
          approverRole: step.approverRole,
          approverId: step.approverId,
          status: ApprovalStatus.PENDING
        }))
      });

      await tx.annualLeaveRequest.create({
        data: {
          requestId: request.id,
          targetUserId: actor.id,
          targetRole: actor.role,
          startDate: computed.startDateUtc,
          endDate: computed.endDateUtc,
          requestedDays: computed.requestedDays,
          reason: computed.reason,
          contextVendorId: leaveContext.vendorId,
          contextChainId: leaveContext.chainId,
          balanceCarriedSnapshot: new Prisma.Decimal(balance.carriedBalanceDays),
          balanceAccruedSnapshot: new Prisma.Decimal(
            balance.currentYearAccruedDays
          ),
          balanceTakenSnapshot: new Prisma.Decimal(balance.annualTakenThisYear),
          balanceHeldSnapshot: new Prisma.Decimal(hold.heldDays),
          availableBeforeRequestSnapshot: new Prisma.Decimal(
            hold.availableToRequest
          ),
          availableAfterRequestSnapshot: new Prisma.Decimal(
            hold.availableToRequest - computed.requestedDays
          )
        }
      });

      return tx.request.findUniqueOrThrow({
        where: { id: request.id },
        include: requestInclude
      });
    });

    await this.auditService.log({
      actorUserId: actor.id,
      action: "ANNUAL_LEAVE_REQUEST_CREATED",
      entityType: "Request",
      entityId: created.id,
      newValue: {
        id: created.id,
        type: created.type,
        status: created.status,
        currentStep: created.currentStep,
        targetUserId: created.targetUserId,
        startDate: computed.startDate,
        endDate: computed.endDate,
        requestedDays: computed.requestedDays
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.notifyInitialApproval(resolvedSteps[0], created.id, created.type);

    return toRequestSummary(created);
  }

  async assertApprovalStillValid(
    requestId: string,
    // The approval id is part of the contract the approvals engine calls with,
    // but the balance re-check is keyed on the request, not the approval.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _approvalId: string
  ): Promise<void> {
    const annualLeave = await this.prisma.annualLeaveRequest.findUnique({
      where: { requestId },
      include: {
        targetUser: {
          select: { id: true, role: true, joiningDate: true }
        }
      }
    });

    if (!annualLeave) {
      throw new NotFoundException("Annual leave request was not found.");
    }

    const asOf = new Date();
    const balance = await this.balanceService.getForUser(
      {
        id: annualLeave.targetUser.id,
        role: annualLeave.targetUser.role,
        joiningDate: annualLeave.targetUser.joiningDate
      },
      asOf
    );

    const hold = await this.computeHold(
      annualLeave.targetUserId,
      balance,
      asOf,
      requestId
    );

    if (annualLeave.requestedDays > hold.availableToRequest) {
      throw new BadRequestException(
        "Annual leave balance is no longer sufficient to approve this request."
      );
    }
  }

  private async loadBalance(
    actor: AuthenticatedUser,
    asOf: Date
  ): Promise<AnnualLeaveBalance> {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, joiningDate: true }
    });

    if (!user) {
      throw new NotFoundException("User was not found.");
    }

    return this.balanceService.getForUser(
      { id: user.id, role: user.role, joiningDate: user.joiningDate },
      asOf
    );
  }

  private computeRequest(dto: CreateAnnualLeaveRequestDto): ComputedRequest {
    const startDate = dto.startDate.trim();
    const endDate = dto.endDate.trim();
    const startDateUtc = this.toUtcDate(startDate, "startDate");
    const endDateUtc = this.toUtcDate(endDate, "endDate");
    const requestedDays =
      Math.floor(
        (endDateUtc.getTime() - startDateUtc.getTime()) / 86_400_000
      ) + 1;

    return {
      startDate,
      endDate,
      startDateUtc,
      endDateUtc,
      requestedDays,
      reason: dto.reason.trim()
    };
  }

  // V1 policy: annual leave can only be requested within the current (asOf)
  // year. Next-year balance accrual is out of scope.
  private currentYearViolation(
    computed: ComputedRequest,
    asOf: Date
  ): string | null {
    const year = asOf.getUTCFullYear();
    if (
      computed.startDateUtc.getUTCFullYear() !== year ||
      computed.endDateUtc.getUTCFullYear() !== year
    ) {
      return `Annual leave requests are limited to ${year}. Choose start and end dates within the current year.`;
    }

    return null;
  }

  private toUtcDate(value: string, fieldName: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }
    return parsed;
  }

  private buildApprovalSteps(role: UserRole): ApprovalStep[] {
    if (role === UserRole.PICKER) {
      return [
        ApprovalStep.CHAMP_APPROVAL,
        ApprovalStep.AREA_MANAGER_APPROVAL,
        ApprovalStep.ADMIN_FINAL_APPROVAL
      ];
    }
    return [
      ApprovalStep.AREA_MANAGER_APPROVAL,
      ApprovalStep.ADMIN_FINAL_APPROVAL
    ];
  }

  private async resolveContext(
    actor: AuthenticatedUser,
    dto: CreateAnnualLeaveRequestDto
  ): Promise<LeaveContext> {
    if (actor.role === UserRole.PICKER) {
      return this.resolvePickerContext(actor.id);
    }
    return this.resolveChampContext(actor.id, dto.contextVendorId);
  }

  private async resolvePickerContext(pickerId: string): Promise<LeaveContext> {
    const assignments = await this.prisma.pickerBranchAssignment.findMany({
      where: { pickerId, status: AssignmentStatus.ACTIVE },
      include: { vendor: { select: { id: true, chainId: true } } }
    });

    if (assignments.length === 0) {
      throw new BadRequestException(
        "You have no active branch assignment to request annual leave."
      );
    }

    if (assignments.length > 1) {
      throw new BadRequestException(
        "You have more than one active branch assignment. Resolve branch assignments before requesting annual leave."
      );
    }

    const assignment = assignments[0];
    return {
      vendorId: assignment.vendor.id,
      chainId: assignment.vendor.chainId
    };
  }

  private async resolveChampContext(
    champId: string,
    contextVendorId?: string
  ): Promise<LeaveContext> {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { champId, status: AssignmentStatus.ACTIVE },
      include: { vendor: { select: { id: true, chainId: true } } }
    });

    if (assignments.length === 0) {
      throw new BadRequestException(
        "You have no active branch assignment to request annual leave."
      );
    }

    if (assignments.length === 1) {
      const assignment = assignments[0];
      return {
        vendorId: assignment.vendor.id,
        chainId: assignment.vendor.chainId
      };
    }

    if (!contextVendorId) {
      throw new BadRequestException(
        "You are assigned to multiple branches. Select a branch (contextVendorId) for this request."
      );
    }

    const selected = assignments.find(
      (assignment) => assignment.vendorId === contextVendorId
    );
    if (!selected) {
      throw new BadRequestException(
        "The selected branch is not one of your active assignments."
      );
    }

    return {
      vendorId: selected.vendor.id,
      chainId: selected.vendor.chainId
    };
  }

  private async resolveChampStep(vendorId: string): Promise<string> {
    const assignments = await this.prisma.vendorChampAssignment.findMany({
      where: { vendorId, status: AssignmentStatus.ACTIVE },
      select: { champId: true }
    });

    // Deterministic V1: a branch must have exactly one active Champ to route
    // the Picker's leave approval. Never pick arbitrarily.
    const champIds = [
      ...new Set(assignments.map((assignment) => assignment.champId))
    ];

    if (champIds.length === 0) {
      throw new BadRequestException(
        "No active Champ on your branch to approve annual leave."
      );
    }

    if (champIds.length > 1) {
      throw new BadRequestException(
        "Your branch has more than one active Champ. A single active Champ is required before annual leave can be requested."
      );
    }

    return champIds[0];
  }

  private async computeHold(
    targetUserId: string,
    balance: AnnualLeaveBalance,
    asOf: Date,
    excludeRequestId: string | null
  ): Promise<HoldComputation> {
    const officialRemainingDays = balance.remainingDays ?? 0;

    const year = asOf.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const otherRequests = await this.prisma.annualLeaveRequest.findMany({
      where: {
        targetUserId,
        request: { is: { status: { in: ACTIVE_HOLD_STATUSES } } },
        ...(excludeRequestId ? { requestId: { not: excludeRequestId } } : {})
      },
      select: { startDate: true, endDate: true }
    });

    const heldDates = new Set<string>();
    for (const leave of otherRequests) {
      for (const day of this.enumerateDatesInYear(
        leave.startDate,
        leave.endDate,
        year
      )) {
        heldDates.add(day);
      }
    }

    if (heldDates.size > 0) {
      const attendanceAnnualDates = await this.loadAttendanceAnnualDates(
        targetUserId,
        yearStart,
        yearEnd
      );
      for (const date of attendanceAnnualDates) {
        heldDates.delete(date);
      }
    }

    const heldDays = heldDates.size;

    return {
      officialRemainingDays,
      heldDays,
      availableToRequest: officialRemainingDays - heldDays
    };
  }

  private async loadAttendanceAnnualDates(
    userId: string,
    from: Date,
    to: Date
  ): Promise<Set<string>> {
    const records = await this.prisma.attendanceDailyRecord.findMany({
      where: {
        userId,
        isAnnualLeave: true,
        shiftDate: { gte: from, lte: to },
        importBatch: { is: { status: AttendanceImportBatchStatus.ACTIVE } }
      },
      select: { shiftDate: true }
    });

    return new Set(
      records.map((record) => record.shiftDate.toISOString().slice(0, 10))
    );
  }

  // Inclusive UTC calendar dates from start..end, restricted to the asOf year.
  private enumerateDatesInYear(
    start: Date,
    end: Date,
    year: number
  ): string[] {
    const dates: string[] = [];
    const cursor = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate()
      )
    );
    const last = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
    );

    while (cursor.getTime() <= last.getTime()) {
      if (cursor.getUTCFullYear() === year) {
        dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }

  private async hasOverlappingActiveRequest(
    targetUserId: string,
    computed: ComputedRequest,
    excludeRequestId: string | null
  ): Promise<boolean> {
    const overlap = await this.prisma.annualLeaveRequest.findFirst({
      where: {
        targetUserId,
        request: { is: { status: { in: ACTIVE_HOLD_STATUSES } } },
        startDate: { lte: computed.endDateUtc },
        endDate: { gte: computed.startDateUtc },
        ...(excludeRequestId ? { requestId: { not: excludeRequestId } } : {})
      },
      select: { id: true }
    });

    return Boolean(overlap);
  }

  private async notifyInitialApproval(
    approval: InitialApprovalNotificationTarget,
    requestId: string,
    requestType: RequestType
  ) {
    if (!approval.approverId) {
      return;
    }

    await this.notificationsService.create({
      userId: approval.approverId,
      type: "APPROVAL_PENDING",
      title: "Approval pending",
      body: `${requestType} request requires your approval.`,
      payload: { requestId, step: approval.step }
    });
  }

  private assertSelfRequestRole(actor: AuthenticatedUser) {
    if (actor.role !== UserRole.PICKER && actor.role !== UserRole.CHAMP) {
      throw new ForbiddenException(
        "Only Pickers and Champs can request annual leave."
      );
    }
  }

  private eligibilityMessage(balance: AnnualLeaveBalance): string {
    if (balance.eligibilityStatus === "MISSING_JOINING_DATE") {
      return "Joining date is not set, so annual leave cannot be requested.";
    }
    if (balance.eligibilityStatus === "NOT_APPLICABLE") {
      return "Annual leave is available for Pickers and Champs only.";
    }
    if (balance.eligibleFrom) {
      return `Not eligible for annual leave yet. Eligible from ${balance.eligibleFrom}.`;
    }
    return "Not eligible for annual leave yet.";
  }

  private errorMessage(error: BadRequestException): string {
    const response = error.getResponse();
    if (typeof response === "string") {
      return response;
    }
    if (
      response &&
      typeof response === "object" &&
      "message" in response &&
      typeof (response as { message: unknown }).message === "string"
    ) {
      return (response as { message: string }).message;
    }
    return error.message;
  }
}
