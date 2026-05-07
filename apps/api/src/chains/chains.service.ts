import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type Chain } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateChainDto } from "./dto/create-chain.dto";
import type { ListChainsQueryDto } from "./dto/list-chains-query.dto";
import type { UpdateChainDto } from "./dto/update-chain.dto";

const MAX_PAGE_SIZE = 100;

@Injectable()
export class ChainsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  getFoundationStatus() {
    return {
      module: "chains",
      status: "active"
    };
  }

  async list(query: ListChainsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 20));
    const where = this.buildWhere(query);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.chain.count({ where }),
      this.prisma.chain.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map(this.toResponse),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async getById(id: string) {
    const chain = await this.prisma.chain.findUnique({
      where: { id }
    });

    if (!chain) {
      throw new NotFoundException("Chain was not found.");
    }

    return this.toResponse(chain);
  }

  async create(
    dto: CreateChainDto,
    context: {
      actorUserId: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    try {
      const chain = await this.prisma.chain.create({
        data: {
          chainName: dto.chainName.trim(),
          chainCode: this.normalizeCode(dto.chainCode),
          status: dto.status
        }
      });

      await this.auditService.log({
        actorUserId: context.actorUserId,
        action: "CHAIN_CREATED",
        entityType: "Chain",
        entityId: chain.id,
        newValue: this.toAuditValue(chain),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return this.toResponse(chain);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateChainDto,
    context: {
      actorUserId: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ) {
    const current = await this.prisma.chain.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException("Chain was not found.");
    }

    try {
      const chain = await this.prisma.chain.update({
        where: { id },
        data: {
          chainName: dto.chainName?.trim(),
          chainCode: dto.chainCode ? this.normalizeCode(dto.chainCode) : undefined,
          status: dto.status
        }
      });

      await this.auditService.log({
        actorUserId: context.actorUserId,
        action: "CHAIN_UPDATED",
        entityType: "Chain",
        entityId: chain.id,
        oldValue: this.toAuditValue(current),
        newValue: this.toAuditValue(chain),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return this.toResponse(chain);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private buildWhere(query: ListChainsQueryDto): Prisma.ChainWhereInput {
    const search = query.q?.trim();

    return {
      status: query.status,
      ...(search
        ? {
            OR: [
              { chainName: { contains: search, mode: "insensitive" } },
              { chainCode: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private toResponse(chain: Chain) {
    return {
      id: chain.id,
      chainName: chain.chainName,
      chainCode: chain.chainCode,
      status: chain.status,
      createdAt: chain.createdAt,
      updatedAt: chain.updatedAt
    };
  }

  private toAuditValue(chain: Chain) {
    return {
      id: chain.id,
      chainName: chain.chainName,
      chainCode: chain.chainCode,
      status: chain.status
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Chain code already exists.");
    }

    throw error;
  }
}
