import { Inject, Injectable } from "@nestjs/common";
import {
  AccountStatus,
  ApprovalStatus,
  ApprovalStep,
  AssignmentStatus,
  EmploymentStatus,
  Prisma,
  RequestType
} from "@prisma/client";

import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "../assignments/assignment-response.utils";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AdminPageQueryDto,
  ListArchivedUsersQueryDto,
  ListAuditLogsQueryDto
} from "./dto/list-admin-query.dto";

const MAX_PAGE_SIZE = 100;
const SECRET_KEY_PARTS = ["password", "secret", "token", "credential"];

const adminRequestInclude = {
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

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
              type: { in: [RequestType.RESIGNATION, RequestType.TERMINATION] }
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
                EmploymentStatus.TERMINATED,
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

    if (type === RequestType.RESIGNATION || type === RequestType.TERMINATION) {
      return "Confirm offboarding/block status";
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

function redactJson(value: Prisma.JsonValue | null): unknown {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item): unknown => redactJson(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]): [string, unknown] => [
      key,
      SECRET_KEY_PARTS.some((part) => key.toLowerCase().includes(part))
        ? "[REDACTED]"
        : redactJson(nested as Prisma.JsonValue)
    ])
  );
}
