import assert from "node:assert/strict";

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { OrdersKpisTargetSettingsController } from "../src/orders-kpis/orders-kpis-target-settings.controller";
import { OrdersKpisTargetSettingsService } from "../src/orders-kpis/orders-kpis-target-settings.service";
import {
  ORDERS_KPI_TARGET_SETTINGS_ID,
  ORDERS_KPI_TARGET_SETTINGS_UPDATED_ACTION,
  type OrdersKpiImportActor,
  type OrdersKpiTargetSettingsValues
} from "../src/orders-kpis/orders-kpis.types";

const adminActor: OrdersKpiImportActor = {
  id: "admin-user-1",
  role: UserRole.ADMIN
};

const pickerActor: OrdersKpiImportActor = {
  id: "picker-user-1",
  role: UserRole.PICKER
};

interface StoredTargetSettings extends OrdersKpiTargetSettingsValues {
  id: string;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createTargetSettings(
  overrides: Partial<StoredTargetSettings> = {}
): StoredTargetSettings {
  const now = new Date("2026-06-10T10:00:00.000Z");

  return {
    id: ORDERS_KPI_TARGET_SETTINGS_ID,
    uhoRateTarget: 8,
    notOnTimeRateTarget: 10,
    qcFailedRateTarget: 5,
    partialRefundRateTarget: 3,
    oosRateTarget: 3,
    priceModifiedRateTarget: 3,
    updatedByUserId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createContext(existingSettings: StoredTargetSettings | null = null) {
  const store = {
    auditLogs: [] as unknown[],
    settings: existingSettings,
    upserts: [] as unknown[]
  };
  const prisma = {
    ordersKpiTargetSettings: {
      findUnique: async () => store.settings,
      upsert: async ({ create, update }: { create: any; update: any }) => {
        store.upserts.push({ create, update });
        const now = new Date("2026-06-10T11:00:00.000Z");
        store.settings = {
          ...(store.settings ?? createTargetSettings({ createdAt: now })),
          ...create,
          ...update,
          updatedAt: now
        };
        return store.settings;
      }
    }
  };
  const auditService = {
    log: async (entry: unknown) => {
      store.auditLogs.push(entry);
    }
  };

  return {
    service: new OrdersKpisTargetSettingsService(
      prisma as never,
      auditService as never
    ),
    store
  };
}

async function testDefaultReadDoesNotMutate() {
  const context = createContext();
  const response = await context.service.getTargetSettings({ actor: adminActor });

  assert.equal(response.source, "DEFAULT");
  assert.equal(response.targets.uhoRateTarget, 8);
  assert.equal(response.targets.notOnTimeRateTarget, 10);
  assert.equal(response.updatedByUserId, null);
  assert.equal(context.store.upserts.length, 0);
  assert.equal(context.store.auditLogs.length, 0);
}

async function testUpdateValidatesPersistsAndAudits() {
  const context = createContext(
    createTargetSettings({
      uhoRateTarget: 9
    })
  );
  const response = await context.service.updateTargetSettings(
    {
      uhoRateTarget: 7.123,
      notOnTimeRateTarget: 9,
      qcFailedRateTarget: 4.5,
      partialRefundRateTarget: 2.5,
      oosRateTarget: 3,
      priceModifiedRateTarget: 2
    },
    { actor: adminActor, userAgent: "test-agent" }
  );

  assert.equal(response.source, "SAVED");
  assert.equal(response.targets.uhoRateTarget, 7.12);
  assert.equal(response.updatedByUserId, adminActor.id);
  assert.equal(context.store.upserts.length, 1);
  assert.equal(context.store.auditLogs.length, 1);
  assert.equal(
    (context.store.auditLogs[0] as any).action,
    ORDERS_KPI_TARGET_SETTINGS_UPDATED_ACTION
  );
  assert.equal((context.store.auditLogs[0] as any).entityId, "global");
}

async function testRejectsInvalidAndUnauthorizedRequests() {
  const context = createContext();

  await assert.rejects(
    context.service.getTargetSettings({ actor: pickerActor }),
    ForbiddenException
  );
  await assert.rejects(
    context.service.updateTargetSettings(
      {
        uhoRateTarget: 101,
        notOnTimeRateTarget: 9,
        qcFailedRateTarget: 4,
        partialRefundRateTarget: 2,
        oosRateTarget: 2,
        priceModifiedRateTarget: 2
      },
      { actor: adminActor }
    ),
    BadRequestException
  );
  assert.equal(context.store.upserts.length, 0);
  assert.equal(context.store.auditLogs.length, 0);
}

function testControllerRoles() {
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, OrdersKpisTargetSettingsController),
    [UserRole.ADMIN, UserRole.SUPER_ADMIN]
  );
}

async function main() {
  await testDefaultReadDoesNotMutate();
  await testUpdateValidatesPersistsAndAudits();
  await testRejectsInvalidAndUnauthorizedRequests();
  testControllerRoles();
}

void main();
