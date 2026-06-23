import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AssignmentStatus,
  Chain,
  ChainStatus,
  Prisma,
  User,
  UserRole,
  Vendor,
  VendorStatus
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  toChainSummary,
  toUserSummary,
  toVendorSummary
} from "./assignment-response.utils";
import type { CloseAssignmentDto } from "./dto/close-assignment.dto";
import type { CreateChainAreaManagerAssignmentDto } from "./dto/create-chain-area-manager-assignment.dto";
import type { CreatePickerBranchAssignmentDto } from "./dto/create-picker-branch-assignment.dto";
import type { CreateVendorChampAssignmentDto } from "./dto/create-vendor-champ-assignment.dto";
import type { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto";

const MAX_PAGE_SIZE = 100;

type RequestContext = {
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const pickerAssignmentInclude = {
  picker: true,
  vendor: {
    include: {
      chain: true
    }
  }
} satisfies Prisma.PickerBranchAssignmentInclude;

const vendorChampAssignmentInclude = {
  vendor: {
    include: {
      chain: true
    }
  },
  champ: true
} satisfies Prisma.VendorChampAssignmentInclude;

const chainAreaManagerAssignmentInclude = {
  chain: true,
  areaManager: true
} satisfies Prisma.ChainAreaManagerAssignmentInclude;

type PickerAssignment = Prisma.PickerBranchAssignmentGetPayload<{
  include: typeof pickerAssignmentInclude;
}>;

type VendorChampAssignment = Prisma.VendorChampAssignmentGetPayload<{
  include: typeof vendorChampAssignmentInclude;
}>;

type ChainAreaManagerAssignment =
  Prisma.ChainAreaManagerAssignmentGetPayload<{
    include: typeof chainAreaManagerAssignmentInclude;
  }>;

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  getFoundationStatus() {
    return {
      module: "assignments",
      status: "active",
      note: "Phase 3 admin assignment hierarchy setup is enabled; lifecycle workflows remain out of scope."
    };
  }

  async getPickerCurrentContext(pickerId: string) {
    const picker = await this.prisma.user.findUnique({ where: { id: pickerId } });

    if (!picker) {
      throw new NotFoundException("Picker was not found.");
    }

    if (picker.role !== UserRole.PICKER) {
      throw new BadRequestException("Selected user is not a Picker.");
    }

    const pickerAssignment = await this.prisma.pickerBranchAssignment.findFirst({
      where: { pickerId, status: AssignmentStatus.ACTIVE },
      include: pickerAssignmentInclude
    });

    if (!pickerAssignment) {
      return {
        picker: toUserSummary(picker),
        pickerBranchAssignment: null,
        vendor: null,
        chain: null,
        vendorChampAssignment: null,
        champ: null,
        chainAreaManagerAssignment: null,
        areaManager: null
      };
    }

    const [vendorChampAssignment, chainAreaManagerAssignment] =
      await this.prisma.$transaction([
        this.prisma.vendorChampAssignment.findFirst({
          where: {
            vendorId: pickerAssignment.vendorId,
            status: AssignmentStatus.ACTIVE
          },
          include: vendorChampAssignmentInclude
        }),
        this.prisma.chainAreaManagerAssignment.findFirst({
          where: {
            chainId: pickerAssignment.vendor.chainId,
            status: AssignmentStatus.ACTIVE
          },
          include: chainAreaManagerAssignmentInclude
        })
      ]);

    return {
      picker: toUserSummary(picker),
      pickerBranchAssignment: this.toPickerAssignmentRecord(pickerAssignment),
      vendor: toVendorSummary(pickerAssignment.vendor),
      chain: toChainSummary(pickerAssignment.vendor.chain),
      vendorChampAssignment: vendorChampAssignment
        ? this.toVendorChampAssignmentRecord(vendorChampAssignment)
        : null,
      champ: vendorChampAssignment ? toUserSummary(vendorChampAssignment.champ) : null,
      chainAreaManagerAssignment: chainAreaManagerAssignment
        ? this.toChainAreaManagerAssignmentRecord(chainAreaManagerAssignment)
        : null,
      areaManager: chainAreaManagerAssignment
        ? toUserSummary(chainAreaManagerAssignment.areaManager)
        : null
    };
  }

  async getVendorCurrentChamp(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { chain: true }
    });

    if (!vendor) {
      throw new NotFoundException("Vendor was not found.");
    }

    const assignment = await this.prisma.vendorChampAssignment.findFirst({
      where: { vendorId, status: AssignmentStatus.ACTIVE },
      include: vendorChampAssignmentInclude
    });

    return {
      vendor: toVendorSummary(vendor),
      vendorChampAssignment: assignment
        ? this.toVendorChampAssignmentRecord(assignment)
        : null,
      champ: assignment ? toUserSummary(assignment.champ) : null
    };
  }

  async getChainCurrentAreaManager(chainId: string) {
    const chain = await this.prisma.chain.findUnique({ where: { id: chainId } });

    if (!chain) {
      throw new NotFoundException("Chain was not found.");
    }

    const assignment = await this.prisma.chainAreaManagerAssignment.findFirst({
      where: { chainId, status: AssignmentStatus.ACTIVE },
      include: chainAreaManagerAssignmentInclude
    });

    return {
      chain: toChainSummary(chain),
      chainAreaManagerAssignment: assignment
        ? this.toChainAreaManagerAssignmentRecord(assignment)
        : null,
      areaManager: assignment ? toUserSummary(assignment.areaManager) : null
    };
  }

  async listPickerBranchAssignments(query: ListAssignmentsQueryDto) {
    const { page, pageSize } = this.getPagination(query);
    const where = this.buildPickerAssignmentWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.pickerBranchAssignment.count({ where }),
      this.prisma.pickerBranchAssignment.findMany({
        where,
        include: pickerAssignmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return this.toPaginated(items.map((item) => this.toPickerAssignmentResponse(item)), {
      page,
      pageSize,
      total
    });
  }

  async listVendorChampAssignments(query: ListAssignmentsQueryDto) {
    const { page, pageSize } = this.getPagination(query);
    const where = this.buildVendorChampAssignmentWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.vendorChampAssignment.count({ where }),
      this.prisma.vendorChampAssignment.findMany({
        where,
        include: vendorChampAssignmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return this.toPaginated(items.map((item) => this.toVendorChampAssignmentResponse(item)), {
      page,
      pageSize,
      total
    });
  }

  async listChainAreaManagerAssignments(query: ListAssignmentsQueryDto) {
    const { page, pageSize } = this.getPagination(query);
    const where = this.buildChainAreaManagerAssignmentWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.chainAreaManagerAssignment.count({ where }),
      this.prisma.chainAreaManagerAssignment.findMany({
        where,
        include: chainAreaManagerAssignmentInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return this.toPaginated(
      items.map((item) => this.toChainAreaManagerAssignmentResponse(item)),
      {
        page,
        pageSize,
        total
      }
    );
  }

  async rejectDirectPickerBranchAssignmentCreate(
    dto: CreatePickerBranchAssignmentDto,
    context: RequestContext
  ) {
    void dto;
    void context;
    throw new BadRequestException(
      "Picker branch assignment must be created through the New Hire workflow."
    );
  }

  async createVendorChampAssignment(
    dto: CreateVendorChampAssignmentDto,
    context: RequestContext
  ) {
    const [vendor, champ, activeAssignment] = await this.prisma.$transaction([
      this.prisma.vendor.findUnique({
        where: { id: dto.vendorId },
        include: { chain: true }
      }),
      this.prisma.user.findUnique({ where: { id: dto.champId } }),
      this.prisma.vendorChampAssignment.findFirst({
        where: { vendorId: dto.vendorId, status: AssignmentStatus.ACTIVE }
      })
    ]);

    this.assertActiveVendor(vendor);
    this.assertUserRole(champ, UserRole.CHAMP, "Champ");

    if (activeAssignment) {
      throw new ConflictException("Vendor already has an active Champ assignment.");
    }

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const createdAssignment = await tx.vendorChampAssignment.create({
          data: {
            vendorId: dto.vendorId,
            champId: dto.champId,
            status: AssignmentStatus.ACTIVE,
            startDate: this.parseDate(dto.startDate)
          },
          include: vendorChampAssignmentInclude
        });

        await tx.auditLog.create({
          data: {
            actorUserId: context.actorUserId,
            action: "VENDOR_CHAMP_ASSIGNMENT_CREATED",
            entityType: "VendorChampAssignment",
            entityId: createdAssignment.id,
            newValue: this.toVendorChampAssignmentAuditValue(createdAssignment),
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        });

        return createdAssignment;
      });

      return this.toVendorChampAssignmentResponse(assignment);
    } catch (error) {
      this.handleActiveAssignmentConflict(
        error,
        "Vendor already has an active Champ assignment."
      );
    }
  }

  async createChainAreaManagerAssignment(
    dto: CreateChainAreaManagerAssignmentDto,
    context: RequestContext
  ) {
    const [chain, areaManager, activeAssignment] = await this.prisma.$transaction([
      this.prisma.chain.findUnique({ where: { id: dto.chainId } }),
      this.prisma.user.findUnique({ where: { id: dto.areaManagerId } }),
      this.prisma.chainAreaManagerAssignment.findFirst({
        where: { chainId: dto.chainId, status: AssignmentStatus.ACTIVE }
      })
    ]);

    this.assertActiveChain(chain);
    this.assertUserRole(areaManager, UserRole.AREA_MANAGER, "Area Manager");

    if (activeAssignment) {
      throw new ConflictException(
        "Chain already has an active Area Manager assignment."
      );
    }

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const createdAssignment = await tx.chainAreaManagerAssignment.create({
          data: {
            chainId: dto.chainId,
            areaManagerId: dto.areaManagerId,
            status: AssignmentStatus.ACTIVE,
            startDate: this.parseDate(dto.startDate)
          },
          include: chainAreaManagerAssignmentInclude
        });

        await tx.auditLog.create({
          data: {
            actorUserId: context.actorUserId,
            action: "CHAIN_AREA_MANAGER_ASSIGNMENT_CREATED",
            entityType: "ChainAreaManagerAssignment",
            entityId: createdAssignment.id,
            newValue:
              this.toChainAreaManagerAssignmentAuditValue(createdAssignment),
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null
          }
        });

        return createdAssignment;
      });

      return this.toChainAreaManagerAssignmentResponse(assignment);
    } catch (error) {
      this.handleActiveAssignmentConflict(
        error,
        "Chain already has an active Area Manager assignment."
      );
    }
  }

  async rejectDirectPickerBranchAssignmentClose(
    id: string,
    dto: CloseAssignmentDto,
    context: RequestContext
  ) {
    void id;
    void dto;
    void context;
    throw new BadRequestException(
      "Picker branch assignment closure must be completed through the Resignation or Transfer workflow."
    );
  }

  async closeVendorChampAssignment(
    id: string,
    dto: CloseAssignmentDto,
    context: RequestContext
  ) {
    const current = await this.prisma.vendorChampAssignment.findUnique({
      where: { id },
      include: vendorChampAssignmentInclude
    });

    if (!current) {
      throw new NotFoundException("Vendor Champ assignment was not found.");
    }

    this.assertCanClose(current.status);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const closedAssignment = await tx.vendorChampAssignment.update({
        where: { id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: this.parseDate(dto.endDate)
        },
        include: vendorChampAssignmentInclude
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "VENDOR_CHAMP_ASSIGNMENT_CLOSED",
          entityType: "VendorChampAssignment",
          entityId: closedAssignment.id,
          oldValue: this.toVendorChampAssignmentAuditValue(current),
          newValue: this.toVendorChampAssignmentAuditValue(closedAssignment),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return closedAssignment;
    });

    return this.toVendorChampAssignmentResponse(assignment);
  }

  async closeChainAreaManagerAssignment(
    id: string,
    dto: CloseAssignmentDto,
    context: RequestContext
  ) {
    const current = await this.prisma.chainAreaManagerAssignment.findUnique({
      where: { id },
      include: chainAreaManagerAssignmentInclude
    });

    if (!current) {
      throw new NotFoundException("Chain Area Manager assignment was not found.");
    }

    this.assertCanClose(current.status);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const closedAssignment = await tx.chainAreaManagerAssignment.update({
        where: { id },
        data: {
          status: AssignmentStatus.CLOSED,
          endDate: this.parseDate(dto.endDate)
        },
        include: chainAreaManagerAssignmentInclude
      });

      await tx.auditLog.create({
        data: {
          actorUserId: context.actorUserId,
          action: "CHAIN_AREA_MANAGER_ASSIGNMENT_CLOSED",
          entityType: "ChainAreaManagerAssignment",
          entityId: closedAssignment.id,
          oldValue: this.toChainAreaManagerAssignmentAuditValue(current),
          newValue:
            this.toChainAreaManagerAssignmentAuditValue(closedAssignment),
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null
        }
      });

      return closedAssignment;
    });

    return this.toChainAreaManagerAssignmentResponse(assignment);
  }

  private getPagination(query: ListAssignmentsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));

    return { page, pageSize };
  }

  private buildPickerAssignmentWhere(
    query: ListAssignmentsQueryDto
  ): Prisma.PickerBranchAssignmentWhereInput {
    const search = query.q?.trim();

    return {
      status: query.status,
      ...(search
        ? {
            OR: [
              { picker: { nameEn: { contains: search, mode: "insensitive" } } },
              { picker: { phoneNumber: { contains: search, mode: "insensitive" } } },
              { picker: { nationalId: { contains: search } } },
              { vendor: { vendorName: { contains: search, mode: "insensitive" } } },
              { vendor: { vendorCode: { contains: search, mode: "insensitive" } } },
              {
                vendor: {
                  chain: { chainName: { contains: search, mode: "insensitive" } }
                }
              },
              {
                vendor: {
                  chain: { chainCode: { contains: search, mode: "insensitive" } }
                }
              }
            ]
          }
        : {})
    };
  }

  private buildVendorChampAssignmentWhere(
    query: ListAssignmentsQueryDto
  ): Prisma.VendorChampAssignmentWhereInput {
    const search = query.q?.trim();

    return {
      status: query.status,
      ...(search
        ? {
            OR: [
              { champ: { nameEn: { contains: search, mode: "insensitive" } } },
              { champ: { phoneNumber: { contains: search, mode: "insensitive" } } },
              { champ: { nationalId: { contains: search } } },
              { vendor: { vendorName: { contains: search, mode: "insensitive" } } },
              { vendor: { vendorCode: { contains: search, mode: "insensitive" } } },
              {
                vendor: {
                  chain: { chainName: { contains: search, mode: "insensitive" } }
                }
              },
              {
                vendor: {
                  chain: { chainCode: { contains: search, mode: "insensitive" } }
                }
              }
            ]
          }
        : {})
    };
  }

  private buildChainAreaManagerAssignmentWhere(
    query: ListAssignmentsQueryDto
  ): Prisma.ChainAreaManagerAssignmentWhereInput {
    const search = query.q?.trim();

    return {
      status: query.status,
      ...(search
        ? {
            OR: [
              {
                areaManager: {
                  nameEn: { contains: search, mode: "insensitive" }
                }
              },
              {
                areaManager: {
                  phoneNumber: { contains: search, mode: "insensitive" }
                }
              },
              {
                areaManager: {
                  nationalId: { contains: search }
                }
              },
              { chain: { chainName: { contains: search, mode: "insensitive" } } },
              { chain: { chainCode: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private toPaginated<T>(
    items: T[],
    meta: { page: number; pageSize: number; total: number }
  ) {
    return {
      items,
      meta: {
        page: meta.page,
        pageSize: meta.pageSize,
        total: meta.total,
        totalPages: Math.max(1, Math.ceil(meta.total / meta.pageSize))
      }
    };
  }

  private toPickerAssignmentResponse(assignment: PickerAssignment) {
    return {
      ...this.toPickerAssignmentRecord(assignment),
      picker: toUserSummary(assignment.picker),
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain)
    };
  }

  private toVendorChampAssignmentResponse(assignment: VendorChampAssignment) {
    return {
      ...this.toVendorChampAssignmentRecord(assignment),
      vendor: toVendorSummary(assignment.vendor),
      chain: toChainSummary(assignment.vendor.chain),
      champ: toUserSummary(assignment.champ)
    };
  }

  private toChainAreaManagerAssignmentResponse(
    assignment: ChainAreaManagerAssignment
  ) {
    return {
      ...this.toChainAreaManagerAssignmentRecord(assignment),
      chain: toChainSummary(assignment.chain),
      areaManager: toUserSummary(assignment.areaManager)
    };
  }

  private toPickerAssignmentRecord(assignment: PickerAssignment) {
    return {
      id: assignment.id,
      pickerId: assignment.pickerId,
      vendorId: assignment.vendorId,
      status: assignment.status,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      createdByRequestId: assignment.createdByRequestId,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt
    };
  }

  private toVendorChampAssignmentRecord(assignment: VendorChampAssignment) {
    return {
      id: assignment.id,
      vendorId: assignment.vendorId,
      champId: assignment.champId,
      status: assignment.status,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt
    };
  }

  private toChainAreaManagerAssignmentRecord(
    assignment: ChainAreaManagerAssignment
  ) {
    return {
      id: assignment.id,
      chainId: assignment.chainId,
      areaManagerId: assignment.areaManagerId,
      status: assignment.status,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt
    };
  }

  private toPickerAssignmentAuditValue(assignment: PickerAssignment) {
    return this.toPickerAssignmentRecord(assignment);
  }

  private toVendorChampAssignmentAuditValue(assignment: VendorChampAssignment) {
    return this.toVendorChampAssignmentRecord(assignment);
  }

  private toChainAreaManagerAssignmentAuditValue(
    assignment: ChainAreaManagerAssignment
  ) {
    return this.toChainAreaManagerAssignmentRecord(assignment);
  }

  private assertUserRole(
    user: User | null,
    expectedRole: UserRole,
    label: string
  ) {
    if (!user) {
      throw new NotFoundException(`${label} was not found.`);
    }

    if (user.role !== expectedRole) {
      throw new BadRequestException(`Selected user is not a ${label}.`);
    }
  }

  private assertActiveVendor(
    vendor: (Vendor & { chain?: Chain }) | null
  ) {
    if (!vendor) {
      throw new NotFoundException("Vendor was not found.");
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new BadRequestException("Vendor must be ACTIVE for assignments.");
    }
  }

  private assertActiveChain(
    chain: Chain | null
  ) {
    if (!chain) {
      throw new NotFoundException("Chain was not found.");
    }

    if (chain.status !== ChainStatus.ACTIVE) {
      throw new BadRequestException("Chain must be ACTIVE for assignments.");
    }
  }

  private assertCanClose(status: AssignmentStatus) {
    if (status !== AssignmentStatus.ACTIVE) {
      throw new BadRequestException("Only ACTIVE assignments can be closed.");
    }
  }

  private parseDate(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private handleActiveAssignmentConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }
}
