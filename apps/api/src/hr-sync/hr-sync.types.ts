import type { Prisma } from "@prisma/client";
import {
  HrSyncStatus,
  HrSyncTargetSheet,
  HrSyncWorkflowType
} from "@prisma/client";

export type PickerNewHireHrSyncInput = Readonly<{
  finalizerDisplayName: string;
  firstNameEnglish: string;
  secondNameEnglish: string;
  thirdNameEnglish: string;
  nationalId: string;
  phoneNumber: string;
  actualJoiningDate: string;
  homeAddress: string;
}>;

export type PickerNewHireHrSyncPayload = Readonly<{
  finalizerDisplayName: string;
  requestType: "New Hire";
  firstNameEnglish: string;
  secondNameEnglish: string;
  thirdNameEnglish: string;
  nationalId: string;
  phoneNumber: string;
  actualJoiningDate: string;
  homeAddress: string;
  vertical: "Local Shops";
  title: "Picker";
}>;

export type PickerRehireHrSyncPayload = Omit<
  PickerNewHireHrSyncPayload,
  "requestType"
> &
  Readonly<{
    requestType: "Rehire";
  }>;

export type PickerResignationHrSyncInput = Readonly<{
  finalizerDisplayName: string;
  type: string;
  employeeName: string;
  nationalId: string;
  lastWorkingDate: string;
}>;

export type PickerResignationHrSyncPayload = Readonly<{
  finalizerDisplayName: string;
  requestType: "Resign";
  type: string;
  employeeName: string;
  nationalId: string;
  lastWorkingDate: string;
  title: "Picker";
}>;

export type HrSyncLogCreateInput = Readonly<{
  requestId: string;
  workflowType: HrSyncWorkflowType;
  targetSheet: HrSyncTargetSheet;
  payloadSnapshot: Prisma.InputJsonValue;
  errorMessage?: string | null;
}>;

export type HrSyncMarkSentInput = Readonly<{
  responseSnapshot: Prisma.InputJsonValue;
  sentAt?: Date;
}>;

export type HrSyncMarkFailedInput = Readonly<{
  errorMessage: string;
  responseSnapshot?: Prisma.InputJsonValue | null;
}>;

export type HrSyncMarkSkippedInput = Readonly<{
  reason?: string | null;
  responseSnapshot?: Prisma.InputJsonValue | null;
}>;

export type HrSyncEventType = "NEW_HIRE" | "REHIRE" | "RESIGN";

export type HrSyncAppsScriptRequest = Readonly<{
  secret: string;
  eventType: HrSyncEventType;
  payload: object;
}>;

export type HrSyncAppsScriptResponse = Readonly<{
  ok: boolean;
  syncId?: string;
  sheet?: string;
  rowNumber?: number;
  message?: string;
  error?: string;
}>;

export type HrSyncSendInput = Readonly<{
  eventType: HrSyncEventType;
  payload: object;
}>;

export type HrSyncSendSuccess = Readonly<{
  ok: true;
  status: "SENT";
  syncId?: string;
  sheet?: string;
  rowNumber?: number;
  message?: string;
  rawResponse: HrSyncAppsScriptResponse;
}>;

export type HrSyncSendSkipped = Readonly<{
  ok: true;
  status: "SKIPPED";
  reason: string;
}>;

export type HrSyncSendFailure = Readonly<{
  ok: false;
  status: "FAILED";
  error: string;
  rawResponse?: HrSyncAppsScriptResponse | Record<string, unknown>;
}>;

export type HrSyncSendResult =
  | HrSyncSendSuccess
  | HrSyncSendSkipped
  | HrSyncSendFailure;

export { HrSyncStatus, HrSyncTargetSheet, HrSyncWorkflowType };
