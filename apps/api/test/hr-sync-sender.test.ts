import assert from "node:assert/strict";

import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";

import { HrSyncService, type HrSyncSendResult } from "../src/hr-sync";
import { PrismaService } from "../src/prisma/prisma.service";

type FetchCall = {
  url: string;
  init: RequestInit;
};

function createMockConfig(values: {
  enabled: boolean;
  webAppUrl?: string;
  secret?: string;
}) {
  return {
    get: (key: string) => {
      if (key === "hrSync.enabled") return values.enabled;
      if (key === "hrSync.webAppUrl") return values.webAppUrl ?? "";
      if (key === "hrSync.secret") return values.secret ?? "";
      return undefined;
    }
  };
}

function createService(config: ReturnType<typeof createMockConfig>) {
  const prisma = {
    hrSyncLog: {
      create: async () => {
        throw new Error("sender must not create HrSyncLog rows");
      },
      update: async () => {
        throw new Error("sender must not update HrSyncLog rows");
      },
      findFirst: async () => null
    }
  };

  return new HrSyncService(prisma as never, config as never);
}

function mockFetch(
  handler: (url: string, init: RequestInit) => Promise<Response>
) {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const normalizedUrl = String(url);
    const normalizedInit = init ?? {};
    calls.push({ url: normalizedUrl, init: normalizedInit });
    return handler(normalizedUrl, normalizedInit);
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    }
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

function assertFailed(result: HrSyncSendResult, expectedMessage: RegExp) {
  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.match(result.error, expectedMessage);
  assert.doesNotMatch(result.error, /super-secret/);
}

async function main() {
  {
    const explicitDeps =
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, HrSyncService) ?? [];

    assert.ok(
      explicitDeps.some(
        (dep: { index: number; param: unknown }) =>
          dep.index === 0 && dep.param === PrismaService
      ),
      "HrSyncService must explicitly inject PrismaService"
    );
    assert.ok(
      explicitDeps.some(
        (dep: { index: number; param: unknown }) =>
          dep.index === 1 && dep.param === ConfigService
      ),
      "HrSyncService must explicitly inject ConfigService"
    );
  }

  {
    const fetchMock = mockFetch(async () => {
      throw new Error("fetch should not be called when HR sync is disabled");
    });
    try {
      const service = createService(createMockConfig({ enabled: false }));
      const result = await service.sendToHrSheet({
        eventType: "NEW_HIRE",
        payload: {
          firstNameEnglish: "Picker",
          secondNameEnglish: "",
          thirdNameEnglish: "One"
        }
      });

      assert.deepEqual(result, {
        ok: true,
        status: "SKIPPED",
        reason: "HR sync is disabled"
      });
      assert.equal(fetchMock.calls.length, 0);
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async () =>
      jsonResponse({
        ok: true,
        syncId: "sync-1",
        sheet: "New Hire",
        rowNumber: 7,
        message: "Appended"
      })
    );
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const payload = {
        firstNameEnglish: "Picker",
        secondNameEnglish: "",
        thirdNameEnglish: "One"
      };
      const result = await service.sendToHrSheet({
        eventType: "NEW_HIRE",
        payload
      });

      assert.equal(result.ok, true);
      assert.equal(result.status, "SENT");
      assert.equal(result.syncId, "sync-1");
      assert.equal(result.sheet, "New Hire");
      assert.equal(result.rowNumber, 7);
      assert.equal(result.message, "Appended");
      assert.deepEqual(result.rawResponse, {
        ok: true,
        syncId: "sync-1",
        sheet: "New Hire",
        rowNumber: 7,
        message: "Appended"
      });

      assert.equal(fetchMock.calls.length, 1);
      assert.equal(
        fetchMock.calls[0].url,
        "https://script.google.com/macros/s/example/exec"
      );
      assert.equal(fetchMock.calls[0].init.method, "POST");
      assert.deepEqual(fetchMock.calls[0].init.headers, {
        "content-type": "application/json"
      });
      const body = JSON.parse(String(fetchMock.calls[0].init.body));
      assert.deepEqual(body, {
        secret: "super-secret-value",
        eventType: "NEW_HIRE",
        payload
      });
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async () =>
      jsonResponse({
        ok: false,
        error: "Sheet tab is missing",
        message: "Unable to append"
      })
    );
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const result = await service.sendToHrSheet({
        eventType: "RESIGN",
        payload: { employeeName: "Picker One" }
      });

      assertFailed(result, /Sheet tab is missing/);
      assert.deepEqual(result.rawResponse, {
        ok: false,
        error: "Sheet tab is missing",
        message: "Unable to append"
      });
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async () =>
      jsonResponse({
        ok: false,
        error: "Bad shared secret: super-secret-value",
        message: "Rejected super-secret-value"
      })
    );
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const result = await service.sendToHrSheet({
        eventType: "RESIGN",
        payload: { employeeName: "Picker One" }
      });

      assertFailed(result, /Bad shared secret/);
      assert.equal(result.rawResponse?.error, "Bad shared secret: [redacted]");
      assert.equal(result.rawResponse?.message, "Rejected [redacted]");
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async () =>
      new Response("not json", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    );
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const result = await service.sendToHrSheet({
        eventType: "REHIRE",
        payload: {
          firstNameEnglish: "Picker",
          secondNameEnglish: "",
          thirdNameEnglish: "One"
        }
      });

      assertFailed(result, /Invalid HR sync response JSON/);
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async () => {
      throw new Error("network down with super-secret-value");
    });
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const result = await service.sendToHrSheet({
        eventType: "NEW_HIRE",
        payload: {
          firstNameEnglish: "Picker",
          secondNameEnglish: "",
          thirdNameEnglish: "One"
        }
      });

      assertFailed(result, /network down/);
    } finally {
      fetchMock.restore();
    }
  }

  {
    const fetchMock = mockFetch(async (_url, init) => {
      init.signal?.dispatchEvent(new Event("abort"));
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    try {
      const service = createService(
        createMockConfig({
          enabled: true,
          webAppUrl: "https://script.google.com/macros/s/example/exec",
          secret: "super-secret-value"
        })
      );
      const result = await service.sendToHrSheet({
        eventType: "NEW_HIRE",
        payload: {
          firstNameEnglish: "Picker",
          secondNameEnglish: "",
          thirdNameEnglish: "One"
        }
      });

      assertFailed(result, /timed out|aborted/i);
    } finally {
      fetchMock.restore();
    }
  }
}

main().catch((error: unknown) => {
  throw error;
});
