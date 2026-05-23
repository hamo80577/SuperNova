import { Inject, Injectable } from "@nestjs/common";
import { HrSyncStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import type {
  HrSyncLogCreateInput,
  HrSyncMarkFailedInput,
  HrSyncMarkSentInput,
  PickerNewHireHrSyncInput,
  PickerNewHireHrSyncPayload,
  PickerRehireHrSyncPayload,
  PickerResignationHrSyncInput,
  PickerResignationHrSyncPayload
} from "./hr-sync.types";

@Injectable()
export class HrSyncService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
}
