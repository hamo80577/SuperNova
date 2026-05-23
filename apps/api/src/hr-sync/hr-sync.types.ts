import type { Prisma } from "@prisma/client";
import {
  HrSyncStatus,
  HrSyncTargetSheet,
  HrSyncWorkflowType
} from "@prisma/client";

export type PickerNewHireHrSyncInput = Readonly<{
  finalizerDisplayName: string;
  fullNameEnglish: string;
  nationalId: string;
  phoneNumber: string;
  actualJoiningDate: string;
  homeAddress: string;
}>;

export type PickerNewHireHrSyncPayload = Readonly<{
  finalizerDisplayName: string;
  requestType: "New Hire";
  fullNameEnglish: string;
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

export { HrSyncStatus, HrSyncTargetSheet, HrSyncWorkflowType };
