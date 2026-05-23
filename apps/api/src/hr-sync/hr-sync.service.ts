import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HrSyncStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  HrSyncAppsScriptResponse,
  HrSyncLogCreateInput,
  HrSyncMarkFailedInput,
  HrSyncMarkSentInput,
  HrSyncSendFailure,
  HrSyncSendInput,
  HrSyncSendResult,
  PickerNewHireHrSyncInput,
  PickerNewHireHrSyncPayload,
  PickerRehireHrSyncPayload,
  PickerResignationHrSyncInput,
  PickerResignationHrSyncPayload
} from "./hr-sync.types";

const HR_SYNC_SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class HrSyncService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  buildPickerNewHirePayload(
    input: PickerNewHireHrSyncInput
  ): PickerNewHireHrSyncPayload {
    return {
      finalizerDisplayName: input.finalizerDisplayName,
      requestType: "New Hire",
      fullNameEnglish: input.fullNameEnglish,
      nationalId: input.nationalId,
      phoneNumber: input.phoneNumber,
      actualJoiningDate: input.actualJoiningDate,
      homeAddress: input.homeAddress,
      vertical: "Local Shops",
      title: "Picker"
    };
  }

  buildPickerRehirePayload(
    input: PickerNewHireHrSyncInput
  ): PickerRehireHrSyncPayload {
    return {
      ...this.buildPickerNewHirePayload(input),
      requestType: "Rehire"
    };
  }

  buildPickerResignationPayload(
    input: PickerResignationHrSyncInput
  ): PickerResignationHrSyncPayload {
    return {
      finalizerDisplayName: input.finalizerDisplayName,
      requestType: "Resign",
      type: input.type,
      employeeName: input.employeeName,
      nationalId: input.nationalId,
      lastWorkingDate: input.lastWorkingDate,
      title: "Picker"
    };
  }

  async createSkippedLog(input: HrSyncLogCreateInput) {
    return this.createLog(input, HrSyncStatus.SKIPPED);
  }

  async createNotSentLog(input: HrSyncLogCreateInput) {
    return this.createLog(input, HrSyncStatus.NOT_SENT);
  }

  async markSent(id: string, input: HrSyncMarkSentInput) {
    return this.prisma.hrSyncLog.update({
      where: { id },
      data: {
        status: HrSyncStatus.SENT,
        responseSnapshot: input.responseSnapshot,
        errorMessage: null,
        sentAt: input.sentAt ?? new Date()
      }
    });
  }

  async markFailed(id: string, input: HrSyncMarkFailedInput) {
    return this.prisma.hrSyncLog.update({
      where: { id },
      data: {
        status: HrSyncStatus.FAILED,
        responseSnapshot: input.responseSnapshot ?? Prisma.JsonNull,
        errorMessage: input.errorMessage
      }
    });
  }

  async getLatestForRequest(requestId: string) {
    return this.prisma.hrSyncLog.findFirst({
      where: { requestId },
      orderBy: { createdAt: "desc" }
    });
  }

  async sendToHrSheet(input: HrSyncSendInput): Promise<HrSyncSendResult> {
    const enabled = this.config.get<boolean>("hrSync.enabled") === true;
    if (!enabled) {
      return {
        ok: true,
        status: "SKIPPED",
        reason: "HR sync is disabled"
      };
    }

    const webAppUrl = this.config.get<string>("hrSync.webAppUrl")?.trim();
    const secret = this.config.get<string>("hrSync.secret")?.trim();

    if (!webAppUrl || !secret) {
      return this.failed("HR sync configuration is incomplete.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HR_SYNC_SEND_TIMEOUT_MS);

    try {
      const response = await fetch(webAppUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          secret,
          eventType: input.eventType,
          payload: input.payload
        }),
        signal: controller.signal
      });

      const parsedResponse = this.redactSecretInValue(
        await this.parseAppsScriptResponse(response),
        secret
      );

      if (!response.ok) {
        return this.failed(
          `HR sync HTTP request failed with status ${response.status}.`,
          this.objectResponseOrUndefined(parsedResponse)
        );
      }

      if (!this.isAppsScriptResponse(parsedResponse)) {
        return this.failed(
          "Invalid HR sync response shape.",
          this.objectResponseOrUndefined(parsedResponse)
        );
      }

      if (parsedResponse.ok !== true) {
        return this.failed(
          parsedResponse.error ??
            parsedResponse.message ??
            "HR sync returned a failed response.",
          parsedResponse
        );
      }

      return {
        ok: true,
        status: "SENT",
        ...(parsedResponse.syncId ? { syncId: parsedResponse.syncId } : {}),
        ...(parsedResponse.sheet ? { sheet: parsedResponse.sheet } : {}),
        ...(typeof parsedResponse.rowNumber === "number"
          ? { rowNumber: parsedResponse.rowNumber }
          : {}),
        ...(parsedResponse.message ? { message: parsedResponse.message } : {}),
        rawResponse: parsedResponse
      };
    } catch (error) {
      return this.failed(this.formatSendError(error, secret));
    } finally {
      clearTimeout(timeout);
    }
  }

  private async createLog(
    input: HrSyncLogCreateInput,
    status: HrSyncStatus
  ) {
    return this.prisma.hrSyncLog.create({
      data: {
        requestId: input.requestId,
        workflowType: input.workflowType,
        targetSheet: input.targetSheet,
        status,
        payloadSnapshot: input.payloadSnapshot,
        responseSnapshot: Prisma.JsonNull,
        errorMessage: input.errorMessage ?? null
      }
    });
  }

  private async parseAppsScriptResponse(response: Response) {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new Error("Invalid HR sync response JSON.");
    }
  }

  private isAppsScriptResponse(
    value: unknown
  ): value is HrSyncAppsScriptResponse {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const response = value as Record<string, unknown>;
    return (
      typeof response.ok === "boolean" &&
      (response.syncId === undefined || typeof response.syncId === "string") &&
      (response.sheet === undefined || typeof response.sheet === "string") &&
      (response.rowNumber === undefined ||
        typeof response.rowNumber === "number") &&
      (response.message === undefined || typeof response.message === "string") &&
      (response.error === undefined || typeof response.error === "string")
    );
  }

  private objectResponseOrUndefined(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private failed(
    error: string,
    rawResponse?: HrSyncSendFailure["rawResponse"]
  ): HrSyncSendFailure {
    return {
      ok: false,
      status: "FAILED",
      error,
      ...(rawResponse ? { rawResponse } : {})
    };
  }

  private formatSendError(error: unknown, secret: string) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "HR sync request timed out."
        : error instanceof Error
          ? error.message
          : "HR sync request failed.";

    return this.redactSecret(message, secret);
  }

  private redactSecretInValue(value: unknown, secret: string): unknown {
    if (!secret) {
      return value;
    }

    if (typeof value === "string") {
      return this.redactSecret(value, secret);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactSecretInValue(item, secret));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.redactSecretInValue(item, secret)
        ])
      );
    }

    return value;
  }

  private redactSecret(message: string, secret: string) {
    return secret ? message.split(secret).join("[redacted]") : message;
  }
}
