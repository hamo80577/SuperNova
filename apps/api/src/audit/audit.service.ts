import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  getFoundationStatus() {
    return {
      module: "audit",
      status: "foundation-only"
    };
  }

  async log(params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue,
        newValue: params.newValue,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null
      }
    });
  }
}
