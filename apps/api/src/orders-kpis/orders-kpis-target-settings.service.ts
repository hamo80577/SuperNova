import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  OrdersKpiImportActor,
  OrdersKpiTargetSettingsRequest,
  OrdersKpiTargetSettingsResponse,
  OrdersKpiTargetSettingsValues
} from "./orders-kpis.types";
import {
  ORDERS_KPI_TARGET_SETTINGS_ID,
  ORDERS_KPI_TARGET_SETTINGS_UPDATED_ACTION
} from "./orders-kpis.types";

export const DEFAULT_ORDERS_KPI_TARGET_SETTINGS: OrdersKpiTargetSettingsValues = {
  uhoRateTarget: 8,
  notOnTimeRateTarget: 10,
  qcFailedRateTarget: 5,
  partialRefundRateTarget: 3,
  oosRateTarget: 3,
  priceModifiedRateTarget: 3
};

type OrdersKpiTargetSettingsRow = Prisma.OrdersKpiTargetSettingsGetPayload<object>;

interface OrdersKpiTargetSettingsOptions {
  actor: OrdersKpiImportActor;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class OrdersKpisTargetSettingsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly auditService: AuditService
  ) {}

  async getTargetSettings(
    options: OrdersKpiTargetSettingsOptions
  ): Promise<OrdersKpiTargetSettingsResponse> {
    assertOrdersKpiTargetSettingsReader(options.actor);

    return this.getTargetSettingsForReport();
  }

  async getTargetSettingsForReport(): Promise<OrdersKpiTargetSettingsResponse> {
    const settings = await this.prisma.ordersKpiTargetSettings.findUnique({
      where: { id: ORDERS_KPI_TARGET_SETTINGS_ID }
    });

    return mapTargetSettings(settings);
  }

  async updateTargetSettings(
    request: OrdersKpiTargetSettingsRequest,
    options: OrdersKpiTargetSettingsOptions
  ): Promise<OrdersKpiTargetSettingsResponse> {
    assertOrdersKpiTargetSettingsActor(options.actor);

    const targets = parseTargetSettingsRequest(request);
    const existingSettings = await this.prisma.ordersKpiTargetSettings.findUnique({
      where: { id: ORDERS_KPI_TARGET_SETTINGS_ID }
    });
    const savedSettings = await this.prisma.ordersKpiTargetSettings.upsert({
      where: { id: ORDERS_KPI_TARGET_SETTINGS_ID },
      create: {
        id: ORDERS_KPI_TARGET_SETTINGS_ID,
        ...targets,
        updatedByUserId: options.actor.id
      },
      update: {
        ...targets,
        updatedByUserId: options.actor.id
      }
    });

    await this.auditService.log({
      actorUserId: options.actor.id,
      action: ORDERS_KPI_TARGET_SETTINGS_UPDATED_ACTION,
      entityType: "OrdersKpiTargetSettings",
      entityId: ORDERS_KPI_TARGET_SETTINGS_ID,
      oldValue: existingSettings
        ? toAuditJson({ ...mapTargetSettings(existingSettings).targets })
        : undefined,
      newValue: toAuditJson({
        ...mapTargetSettings(savedSettings).targets,
        updatedByUserId: options.actor.id
      }),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    });

    return mapTargetSettings(savedSettings);
  }
}

function assertOrdersKpiTargetSettingsActor(actor: OrdersKpiImportActor) {
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException("Only admins can manage Orders KPI targets.");
  }
}

function assertOrdersKpiTargetSettingsReader(actor: OrdersKpiImportActor) {
  const allowedRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN
  ];

  if (!allowedRoles.includes(actor.role)) {
    throw new ForbiddenException("Only admins can manage Orders KPI targets.");
  }
}

function parseTargetSettingsRequest(
  request: OrdersKpiTargetSettingsRequest
): OrdersKpiTargetSettingsValues {
  return {
    uhoRateTarget: parseRateTarget("uhoRateTarget", request.uhoRateTarget),
    notOnTimeRateTarget: parseRateTarget(
      "notOnTimeRateTarget",
      request.notOnTimeRateTarget
    ),
    qcFailedRateTarget: parseRateTarget(
      "qcFailedRateTarget",
      request.qcFailedRateTarget
    ),
    partialRefundRateTarget: parseRateTarget(
      "partialRefundRateTarget",
      request.partialRefundRateTarget
    ),
    oosRateTarget: parseRateTarget("oosRateTarget", request.oosRateTarget),
    priceModifiedRateTarget: parseRateTarget(
      "priceModifiedRateTarget",
      request.priceModifiedRateTarget
    )
  };
}

function parseRateTarget(fieldName: string, value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException(`${fieldName} must be a number.`);
  }

  if (numericValue < 0 || numericValue > 100) {
    throw new BadRequestException(`${fieldName} must be between 0 and 100.`);
  }

  return roundTwoDecimals(numericValue);
}

export function mapTargetSettings(
  settings: OrdersKpiTargetSettingsRow | null
): OrdersKpiTargetSettingsResponse {
  if (!settings) {
    return {
      id: ORDERS_KPI_TARGET_SETTINGS_ID,
      source: "DEFAULT",
      targets: DEFAULT_ORDERS_KPI_TARGET_SETTINGS,
      updatedByUserId: null,
      createdAt: null,
      updatedAt: null
    };
  }

  return {
    id: settings.id,
    source: "SAVED",
    targets: {
      uhoRateTarget: decimalToNumber(settings.uhoRateTarget),
      notOnTimeRateTarget: decimalToNumber(settings.notOnTimeRateTarget),
      qcFailedRateTarget: decimalToNumber(settings.qcFailedRateTarget),
      partialRefundRateTarget: decimalToNumber(settings.partialRefundRateTarget),
      oosRateTarget: decimalToNumber(settings.oosRateTarget),
      priceModifiedRateTarget: decimalToNumber(settings.priceModifiedRateTarget)
    },
    updatedByUserId: settings.updatedByUserId,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString()
  };
}

function decimalToNumber(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value);
}

function roundTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function toAuditJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}
