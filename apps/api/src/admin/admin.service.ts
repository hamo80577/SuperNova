import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  ChainStatus,
  EmploymentStatus,
  Prisma,
  RequestType,
  UserRole,
  VendorStatus
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { requestInclude as adminRequestInclude } from "../requests/request-includes";
import { RequestsService } from "../requests/requests.service";
import { redactJson } from "../security/sensitive-data.utils";
import type {
  AdminAssignPickerDto,
  AdminReplaceBranchChampDto,
  AdminReplaceChainAreaManagerDto
} from "./dto/admin-organization-action.dto";
import type {
  AdminPageQueryDto,
  ListArchivedUsersQueryDto,
  ListAuditLogsQueryDto
} from "./dto/list-admin-query.dto";

const MAX_PAGE_SIZE = 100;

type AdminActionContext = {
  actor: AuthenticatedUser;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestsService)
    private readonly requestsService: RequestsService
  ) {}

  async listPendingActions(query: AdminPageQueryDto) {
    const { page, pageSize, skip } = this.normalizePagination(query);
    const where: Prisma.RequestWhereInput = {
      status: "PENDING_ADMIN",
      currentStep: ApprovalStep.ADMIN_FINAL_APPROVAL,
      approvals: {
        some: {
          step: ApprovalStep.ADMIN_FINAL_APPROVAL,
          status: ApprovalStatus.PENDING
        }
      }
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        include: adminRequestInclude,
        orderBy: { createdAt: "asc" },
        skip,
        take: pageSize
      })
    ]);

    return {
      pendingCount: total,
      items: items.map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        currentStep: request.currentStep,
        createdAt: request.createdAt,
        createdBy: toUserSummary(request.createdBy),
        targetUser: request.targetUser ? toUserSummary(request.targetUser) : null,
        sourceChain: request.sourceChain
          ? toChainSummary(request.sourceChain)
          : null,
        sourceVendor: request.sourceVendor
          ? toVendorSummary(request.sourceVendor)
          : null,
        destinationChain: request.destinationChain
          ? toChainSummary(request.destinationChain)
          : null,
        destinationVendor: request.destinationVendor
          ? toVendorSummary(request.destinationVendor)
          : null,
        requiredActionLabel: this.requiredActionLabel(request.type),
        route: `/requests/${request.id}`
      })),
      meta: this.toMeta(page, pageSize, total)
    };
  }

  async listArchivedUsers(query: ListArchivedUsersQueryDto) {
    const { page, pageSize, skip } = this.normalizePagination(query);
    const where = this.buildArchivedUsersWhere(query);

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        include: {
          targetedRequests: {
            where: {
              type: RequestType.RESIGNATION
            },
            include: {
              sourceChain: true,
              sourceVendor: { include: { chain: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          pickerBranchAssignments: {
            where: { status: AssignmentStatus.CLOSED },
            include: { vendor: { include: { chain: true } } },
            orderBy: { updatedAt: "desc" },
            take: 3
          }
        }
      })
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        role: user.role,
        nameEn: user.nameEn,
        nameAr: user.nameAr,
        phoneNumber: user.phoneNumber,
        shopperId: user.shopperId,
        accountStatus: user.accountStatus,
        employmentStatus: user.employmentStatus,
        resignationDate: user.resignationDate,
        blockStatus: user.blockStatus,
        blockedUntil: user.blockedUntil,
        blockReason: user.blockReason,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        latestOffboardingRequest: user.targetedRequests[0]
          ? {
              id: user.targetedRequests[0].id,
              type: user.targetedRequests[0].type,
              status: user.targetedRequests[0].status,
              createdAt: user.targetedRequests[0].createdAt,
              sourceChain: user.targetedRequests[0].sourceChain
                ? toChainSummary(user.targetedRequests[0].sourceChain)
                : null,
              sourceVendor: user.targetedRequests[0].sourceVendor
                ? toVendorSummary(user.targetedRequests[0].sourceVendor)
                : null
            }
          : null,
        closedAssignments: user.pickerBranchAssignments.map((assignment) => ({
          id: assignment.id,
          status: assignment.status,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          vendor: toVendorSummary(assignment.vendor),
          chain: toChainSummary(assignment.vendor.chain)
        }))
      })),
      meta: this.toMeta(page, pageSize, total)
    };
  }

  async listAuditLogs(query: ListAuditLogsQueryDto) {
    const { page, pageSize, skip } = this.normalizePagination(query);
    const where = this.buildAuditWhere(query);

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      })
    ]);

    return {
      items: logs.map((log) => ({
        id: log.id,
        actor: log.actor ? toUserSummary(log.actor) : null,
        actorUserId: log.actorUserId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        oldValue: redactJson(log.oldValue),
        newValue: redactJson(log.newValue),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt
      })),
      meta: this.toMeta(page, pageSize, total)
    };
  }

  async getOrganization() {
    const chains = await this.prisma.chain.findMany({
      include: {
        areaManagerAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { areaManager: true },
          orderBy: { startDate: "desc" },
          take: 1
        },
        vendors: {
          include: {
            champAssignments: {
              where: { status: AssignmentStatus.ACTIVE },
              include: { champ: true },
              orderBy: { startDate: "desc" },
              take: 1
            },
            pickerAssignments: {
              where: { status: AssignmentStatus.ACTIVE },
              select: { id: true }
            }
          },
          orderBy: { vendorName: "asc" }
        }
      },
      orderBy: { chainName: "asc" }
    });

    const vendorIds = chains.flatMap((chain) =>
      chain.vendors.map((vendor) => vendor.id)
    );
    const requestCounts = await this.getRequestCountsByVendor(vendorIds);

    return {
      chains: chains.map((chain) => {
        const branches = chain.vendors.map((vendor) => {
          const requestCount = requestCounts.get(vendor.id) ?? 0;
          return {
            ...toVendorSummary({ ...vendor, chain }),
            activePickerCount: vendor.pickerAssignments.length,
            requestCount,
            currentChamp: vendor.champAssignments[0]?.champ
              ? toUserSummary(vendor.champAssignments[0].champ)
              : null
          };
        });
        return {
          ...toChainSummary(chain),
          branchCount: branches.length,
          activePickerCount: branches.reduce(
            (total, branch) => total + branch.activePickerCount,
            0
          ),
          requestCount: branches.reduce(
            (total, branch) => total + branch.requestCount,
            0
          ),
          currentAreaManager: chain.areaManagerAssignments[0]?.areaManager
            ? toUserSummary(chain.areaManagerAssignments[0].areaManager)
            : null,
          branches
        };
      })
    };
  }

  async getOrganizationBranch(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        chain: true,
        champAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { champ: true },
          orderBy: { startDate: "desc" },
          take: 1
        },
        pickerAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { picker: true },
          orderBy: { startDate: "asc" }
        }
      }
    });

    if (!vendor) {
      throw new NotFoundException("Branch was not found.");
    }

    const recentRequests = await this.prisma.request.findMany({
      where: {
        OR: [{ sourceVendorId: vendorId }, { destinationVendorId: vendorId }]
      },
      include: adminRequestInclude,
      orderBy: { createdAt: "desc" },
      take: 12
    });

    return {
      branch: toVendorSummary(vendor),
      chain: toChainSummary(vendor.chain),
      currentChamp: vendor.champAssignments[0]
        ? {
            assignment: {
              id: vendor.champAssignments[0].id,
              status: vendor.champAssignments[0].status,
              startDate: vendor.champAssignments[0].startDate,
              endDate: vendor.champAssignments[0].endDate
            },
            champ: toUserSummary(vendor.champAssignments[0].champ)
          }
        : null,
      pickers: vendor.pickerAssignments.map((assignment) => ({
        assignment: {
          id: assignment.id,
          status: assignment.status,
          startDate: assignment.startDate,
          endDate: assignment.endDate
        },
        picker: toUserSummary(assignment.picker)
      })),
      requests: recentRequests.map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        currentStep: request.currentStep,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        targetUser: request.targetUser ? toUserSummary(request.targetUser) : null,
        route: `/requests/${request.id}`
      }))
    };
  }

  async assignPickerToBranch(
    vendorId: string,
    dto: AdminAssignPickerDto,
    context: AdminActionContext
  ) {
    const [vendor, picker, activeAssignment] = await this.prisma.$transaction([
      this.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { chain: true }
      }),
      this.prisma.user.findUnique({ where: { id: dto.pickerId } }),
      this.prisma.pickerBranchAssignment.findFirst({
        where: { pickerId: dto.pickerId, status: AssignmentStatus.ACTIVE },
        include: { vendor: { include: { chain: true } } }
      })
    ]);

    this.assertActiveBranch(vendor);
    this.assertUserRole(picker, UserRole.PICKER, "Picker");
    this.assertActiveAccount(picker, "Picker");

    if (activeAssignment?.vendorId === vendorId) {
      return {
        mode: "NO_CHANGE" as const,
        message: "Picker is already assigned to this Branch."
      };
    }

    if (activeAssignment) {
      const request = await this.requestsService.createTransfer(
        {
          sourceVendorId: activeAssignment.vendorId,
          targetUserId: dto.pickerId,
          destinationVendorId: vendorId,
          reason: "Admin organization assignment transfer.",
          requestedTransferDate: dto.startDate,
          notes: "Created from Admin Organization Control Center."
        },
        {
          actor: context.actor,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      );

      return {
        mode: "TRANSFER_REQUEST_CREATED" as const,
        request
      };
    }

    throw new BadRequestException(
      "Picker branch assignment must be created through the New Hire workflow."
    );
  }

  async replaceBranchChamp(
    vendorId: string,
    dto: AdminReplaceBranchChampDto,
    context: AdminActionContext
  ) {
    const [vendor, champ, currentAssignment] = await this.prisma.$transaction([
      this.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { chain: true }
      }),
      this.prisma.user.findUnique({ where: { id: dto.champId } }),
      this.prisma.vendorChampAssignment.findFirst({
        where: { vendorId, status: AssignmentStatus.ACTIVE },
        include: { champ: true }
      })
    ]);

    this.assertActiveBranch(vendor);
    this.assertUserRole(champ, UserRole.CHAMP, "Champ");
    this.assertActiveAccount(champ, "Champ");

    if (currentAssignment?.champId === dto.champId) {
      return {
        mode: "NO_CHANGE" as const,
        message: "Champ is already assigned to this Branch."
      };
    }

    const now = new Date();
    const startDate = this.parseDate(dto.startDate);
    const created = await this.prisma.$transaction(async (tx) => {
      if (currentAssignment) {
        await tx.vendorChampAssignment.update({
          where: { id: currentAssignment.id },
          data: { status: AssignmentStatus.CLOSED, endDate: now }
        });
      }

      const next = await tx.vendorChampAssignment.create({
        data: {
          vendorId,
          champId: dto.champId,
          status: AssignmentStatus.ACTIVE,
          startDate
        },
        include: {
          champ: true,
          vendor: { include: { chain: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actor.id,
          action: "ADMIN_BRANCH_CHAMP_REPLACED",
          entityType: "VendorChampAssignment",
          entityId: next.id,
          oldValue: currentAssignment
            ? {
                assignmentId: currentAssignment.id,
                champId: currentAssignment.champId,
                vendorId: currentAssignment.vendorId
              }
            : undefined,
          newValue: {
            assignmentId: next.id,
            champId: next.champId,
            vendorId: next.vendorId
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return next;
    });

    await this.notificationsService.create({
      userId: dto.champId,
      type: "ASSIGNMENT_UPDATED",
      title: "Branch Champ assignment",
      body: `You are now assigned to ${vendor.vendorName}.`,
      payload: { vendorId, assignmentId: created.id }
    });

    if (currentAssignment) {
      await this.notificationsService.create({
        userId: currentAssignment.champId,
        type: "ASSIGNMENT_UPDATED",
        title: "Branch Champ assignment ended",
        body: `Your assignment to ${vendor.vendorName} was closed.`,
        payload: { vendorId, assignmentId: currentAssignment.id }
      });
    }

    await this.notifyChainAreaManager(vendor.chainId, {
      type: "ASSIGNMENT_UPDATED",
      title: "Branch Champ changed",
      body: `${champ.nameEn} is now assigned to ${vendor.vendorName}.`,
      payload: { vendorId, champId: champ.id, assignmentId: created.id }
    });

    return {
      mode: "CHAMP_REPLACED" as const,
      assignment: {
        id: created.id,
        status: created.status,
        startDate: created.startDate,
        champ: toUserSummary(created.champ),
        branch: toVendorSummary(created.vendor)
      }
    };
  }

  async replaceChainAreaManager(
    chainId: string,
    dto: AdminReplaceChainAreaManagerDto,
    context: AdminActionContext
  ) {
    const [chain, areaManager, currentAssignment] =
      await this.prisma.$transaction([
        this.prisma.chain.findUnique({ where: { id: chainId } }),
        this.prisma.user.findUnique({ where: { id: dto.areaManagerId } }),
        this.prisma.chainAreaManagerAssignment.findFirst({
          where: { chainId, status: AssignmentStatus.ACTIVE },
          include: { areaManager: true }
        })
      ]);

    this.assertActiveChain(chain);
    this.assertUserRole(areaManager, UserRole.AREA_MANAGER, "Area Manager");
    this.assertActiveAccount(areaManager, "Area Manager");

    if (currentAssignment?.areaManagerId === dto.areaManagerId) {
      return {
        mode: "NO_CHANGE" as const,
        message: "Area Manager is already assigned to this Chain."
      };
    }

    const now = new Date();
    const startDate = this.parseDate(dto.startDate);
    const created = await this.prisma.$transaction(async (tx) => {
      if (currentAssignment) {
        await tx.chainAreaManagerAssignment.update({
          where: { id: currentAssignment.id },
          data: { status: AssignmentStatus.CLOSED, endDate: now }
        });
      }

      const next = await tx.chainAreaManagerAssignment.create({
        data: {
          chainId,
          areaManagerId: dto.areaManagerId,
          status: AssignmentStatus.ACTIVE,
          startDate
        },
        include: { areaManager: true, chain: true }
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actor.id,
          action: "ADMIN_CHAIN_AREA_MANAGER_REPLACED",
          entityType: "ChainAreaManagerAssignment",
          entityId: next.id,
          oldValue: currentAssignment
            ? {
                assignmentId: currentAssignment.id,
                areaManagerId: currentAssignment.areaManagerId,
                chainId: currentAssignment.chainId
              }
            : undefined,
          newValue: {
            assignmentId: next.id,
            areaManagerId: next.areaManagerId,
            chainId: next.chainId
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return next;
    });

    await this.notificationsService.create({
      userId: dto.areaManagerId,
      type: "ASSIGNMENT_UPDATED",
      title: "Chain assignment updated",
      body: `You are now assigned to ${chain.chainName}.`,
      payload: { chainId, assignmentId: created.id }
    });

    if (currentAssignment) {
      await this.notificationsService.create({
        userId: currentAssignment.areaManagerId,
        type: "ASSIGNMENT_UPDATED",
        title: "Chain assignment ended",
        body: `Your assignment to ${chain.chainName} was closed.`,
        payload: { chainId, assignmentId: currentAssignment.id }
      });
    }

    await this.notificationsService.notifyAdmins({
      type: "ASSIGNMENT_UPDATED",
      title: "Area Manager changed",
      body: `${areaManager.nameEn} is now assigned to ${chain.chainName}.`,
      payload: { chainId, areaManagerId: areaManager.id, assignmentId: created.id }
    });

    return {
      mode: "AREA_MANAGER_REPLACED" as const,
      assignment: {
        id: created.id,
        status: created.status,
        startDate: created.startDate,
        areaManager: toUserSummary(created.areaManager),
        chain: toChainSummary(created.chain)
      }
    };
  }

  private async getRequestCountsByVendor(vendorIds: string[]) {
    const counts = new Map<string, number>();

    if (!vendorIds.length) {
      return counts;
    }

    const requests = await this.prisma.request.findMany({
      where: {
        OR: [
          { sourceVendorId: { in: vendorIds } },
          { destinationVendorId: { in: vendorIds } }
        ]
      },
      select: {
        sourceVendorId: true,
        destinationVendorId: true
      }
    });

    requests.forEach((request) => {
      if (request.sourceVendorId) {
        counts.set(
          request.sourceVendorId,
          (counts.get(request.sourceVendorId) ?? 0) + 1
        );
      }

      if (
        request.destinationVendorId &&
        request.destinationVendorId !== request.sourceVendorId
      ) {
        counts.set(
          request.destinationVendorId,
          (counts.get(request.destinationVendorId) ?? 0) + 1
        );
      }
    });

    return counts;
  }

  private async notifyActiveBranchChamp(
    vendorId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      payload?: Prisma.InputJsonValue;
    }
  ) {
    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: { vendorId, status: AssignmentStatus.ACTIVE },
      select: { champId: true }
    });

    if (!assignment) {
      return;
    }

    await this.notificationsService.create({
      userId: assignment.champId,
      ...notification
    });
  }

  private async notifyChainAreaManager(
    chainId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      payload?: Prisma.InputJsonValue;
    }
  ) {
    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: { chainId, status: AssignmentStatus.ACTIVE },
      select: { areaManagerId: true }
    });

    if (!assignment) {
      return;
    }

    await this.notificationsService.create({
      userId: assignment.areaManagerId,
      ...notification
    });
  }

  private assertActiveBranch(
    vendor: { status: VendorStatus; chain: { status: ChainStatus } } | null
  ): asserts vendor is { status: VendorStatus; chain: { status: ChainStatus } } {
    if (!vendor) {
      throw new NotFoundException("Branch was not found.");
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Branch is not active.");
    }

    if (vendor.chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Branch Chain is not active.");
    }
  }

  private assertActiveChain(
    chain: { status: ChainStatus } | null
  ): asserts chain is { status: ChainStatus } {
    if (!chain) {
      throw new NotFoundException("Chain was not found.");
    }

    if (chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Chain is not active.");
    }
  }

  private assertUserRole(
    user: { role: UserRole } | null,
    expectedRole: UserRole,
    label: string
  ): asserts user is { role: UserRole } {
    if (!user) {
      throw new NotFoundException(`${label} was not found.`);
    }

    if (user.role !== expectedRole) {
      throw new BadRequestException(`Selected user is not a ${label}.`);
    }
  }

  private assertActiveAccount(
    user: { accountStatus: AccountStatus },
    label: string
  ) {
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`${label} account is not active.`);
    }
  }

  private parseDate(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private buildArchivedUsersWhere(
    query: ListArchivedUsersQueryDto
  ): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [
      {
        OR: [
          {
            accountStatus: {
              in: [
                AccountStatus.INACTIVE,
                AccountStatus.SUSPENDED,
                AccountStatus.ARCHIVED
              ]
            }
          },
          {
            employmentStatus: {
              in: [
                EmploymentStatus.RESIGNED,
                EmploymentStatus.ARCHIVED
              ]
            }
          }
        ]
      }
    ];

    if (query.role) {
      filters.push({ role: query.role });
    }

    if (query.accountStatus) {
      filters.push({ accountStatus: query.accountStatus });
    }

    if (query.employmentStatus) {
      filters.push({ employmentStatus: query.employmentStatus });
    }

    if (query.blockStatus) {
      filters.push({ blockStatus: query.blockStatus });
    }

    const search = query.q?.trim();
    if (search) {
      filters.push({
        OR: [
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameAr: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
          { shopperId: { contains: search, mode: "insensitive" } },
          { blockReason: { contains: search, mode: "insensitive" } }
        ]
      });
    }

    return { AND: filters };
  }

  private buildAuditWhere(query: ListAuditLogsQueryDto): Prisma.AuditLogWhereInput {
    const filters: Prisma.AuditLogWhereInput[] = [];

    if (query.actorUserId) {
      filters.push({ actorUserId: query.actorUserId });
    }

    if (query.action) {
      filters.push({ action: { contains: query.action.trim(), mode: "insensitive" } });
    }

    if (query.entityType) {
      filters.push({
        entityType: { contains: query.entityType.trim(), mode: "insensitive" }
      });
    }

    if (query.entityId) {
      filters.push({ entityId: query.entityId });
    }

    if (query.from || query.to) {
      filters.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {})
        }
      });
    }

    const search = query.q?.trim();
    if (search) {
      filters.push({
        OR: [
          { action: { contains: search, mode: "insensitive" } },
          { entityType: { contains: search, mode: "insensitive" } },
          { entityId: { contains: search, mode: "insensitive" } },
          { actor: { nameEn: { contains: search, mode: "insensitive" } } },
          { actor: { phoneNumber: { contains: search, mode: "insensitive" } } }
        ]
      });
    }

    return filters.length ? { AND: filters } : {};
  }

  private requiredActionLabel(type: RequestType) {
    if (type === RequestType.NEW_HIRE) {
      return "Enter Shopper ID";
    }

    if (type === RequestType.RESIGNATION) {
      return "Confirm Resignation/block status";
    }

    return "Review request";
  }

  private normalizePagination(query: AdminPageQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));

    return {
      page,
      pageSize,
      skip: (page - 1) * pageSize
    };
  }

  private toMeta(page: number, pageSize: number, total: number) {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }
}
