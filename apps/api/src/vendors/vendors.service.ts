import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type Vendor } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateVendorDto } from "./dto/create-vendor.dto";
import type { ListVendorsQueryDto } from "./dto/list-vendors-query.dto";
import type { UpdateVendorDto } from "./dto/update-vendor.dto";

const MAX_PAGE_SIZE = 100;

type VendorWithChain = Vendor & {
  chain: {
    id: string;
    chainName: string;
    chainCode: string;
    status: string;
  };
};

@Injectable()
export class VendorsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  getFoundationStatus() {
    return {
      module: "vendors",
      status: "active"
    };
  }

  async list(query: ListVendorsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({
        where,
        include: {
          chain: {
            select: {
              id: true,
              chainName: true,
              chainCode: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map((vendor) => this.toResponse(vendor)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        chain: {
          select: {
            id: true,
            chainName: true,
            chainCode: true,
            status: true
          }
        }
      }
    });

    if (!vendor) {
      throw new NotFoundException("Vendor was not found.");
    }

    return this.toResponse(vendor);
  }

  async create(
    dto: CreateVendorDto,
    context: {
      actorUserId: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    await this.ensureChainExists(dto.chainId);

    try {
      const vendor = await this.prisma.vendor.create({
        data: {
          vendorName: dto.vendorName.trim(),
          vendorCode: this.normalizeCode(dto.vendorCode),
          vendorExternalId: this.normalizeOptional(dto.vendorExternalId),
          chainId: dto.chainId,
          status: dto.status,
          address: this.normalizeOptional(dto.address),
          area: this.normalizeOptional(dto.area),
          city: this.normalizeOptional(dto.city)
        },
        include: {
          chain: {
            select: {
              id: true,
              chainName: true,
              chainCode: true,
              status: true
            }
          }
        }
      });

      await this.auditService.log({
        actorUserId: context.actorUserId,
        action: "VENDOR_CREATED",
        entityType: "Vendor",
        entityId: vendor.id,
        newValue: this.toAuditValue(vendor),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return this.toResponse(vendor);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    context: {
      actorUserId: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const current = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        chain: {
          select: {
            id: true,
            chainName: true,
            chainCode: true,
            status: true
          }
        }
      }
    });

    if (!current) {
      throw new NotFoundException("Vendor was not found.");
    }

    if (dto.chainId) {
      await this.ensureChainExists(dto.chainId);
    }

    try {
      const vendor = await this.prisma.vendor.update({
        where: { id },
        data: {
          vendorName: dto.vendorName?.trim(),
          vendorCode: dto.vendorCode ? this.normalizeCode(dto.vendorCode) : undefined,
          vendorExternalId:
            dto.vendorExternalId === undefined
              ? undefined
              : this.normalizeOptional(dto.vendorExternalId),
          chainId: dto.chainId,
          status: dto.status,
          address:
            dto.address === undefined ? undefined : this.normalizeOptional(dto.address),
          area: dto.area === undefined ? undefined : this.normalizeOptional(dto.area),
          city: dto.city === undefined ? undefined : this.normalizeOptional(dto.city)
        },
        include: {
          chain: {
            select: {
              id: true,
              chainName: true,
              chainCode: true,
              status: true
            }
          }
        }
      });

      await this.auditService.log({
        actorUserId: context.actorUserId,
        action: "VENDOR_UPDATED",
        entityType: "Vendor",
        entityId: vendor.id,
        oldValue: this.toAuditValue(current),
        newValue: this.toAuditValue(vendor),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return this.toResponse(vendor);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private buildWhere(query: ListVendorsQueryDto): Prisma.VendorWhereInput {
    const search = query.q?.trim();

    return {
      status: query.status,
      chainId: query.chainId,
      ...(search
        ? {
            OR: [
              { vendorName: { contains: search, mode: "insensitive" } },
              { vendorCode: { contains: search, mode: "insensitive" } },
              { vendorExternalId: { contains: search, mode: "insensitive" } },
              { area: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private async ensureChainExists(chainId: string) {
    const chain = await this.prisma.chain.findUnique({
      where: { id: chainId },
      select: { id: true }
    });

    if (!chain) {
      throw new NotFoundException("Selected chain was not found.");
    }
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private normalizeOptional(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private toResponse(vendor: VendorWithChain) {
    return {
      id: vendor.id,
      vendorName: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      vendorExternalId: vendor.vendorExternalId,
      status: vendor.status,
      chainId: vendor.chainId,
      address: vendor.address,
      area: vendor.area,
      city: vendor.city,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      chain: vendor.chain
    };
  }

  private toAuditValue(vendor: VendorWithChain) {
    return {
      id: vendor.id,
      vendorName: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      vendorExternalId: vendor.vendorExternalId,
      status: vendor.status,
      chainId: vendor.chainId,
      address: vendor.address,
      area: vendor.area,
      city: vendor.city
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : "";
      const label = target.includes("vendorExternalId")
        ? "Vendor external ID"
        : "Vendor code";
      throw new ConflictException(`${label} already exists.`);
    }

    throw error;
  }
}
