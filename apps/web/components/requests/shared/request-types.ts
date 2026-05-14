import { type NewHireTargetRole } from "@/lib/api/requests";

export type OperationsMode = "action" | "submitted" | "open" | "completed" | "rejected";

export type NewHireEntityStatus = "ACTIVE" | "INACTIVE";

export type NewHireChainSource = {
  id: string;
  chainName: string;
  chainCode: string;
  status?: NewHireEntityStatus;
};

export type NewHireVendorSource = {
  id: string;
  vendorName: string;
  vendorCode: string;
  vendorExternalId?: string | null;
  status?: NewHireEntityStatus;
  chainId: string;
  area?: string | null;
  city?: string | null;
  chain?: NewHireChainSource;
};

export type NewHireChainOption = Required<NewHireChainSource>;

export type NewHireVendorOption = Omit<Required<NewHireVendorSource>, "chain"> & {
  chain: NewHireChainOption;
};

export type LockedNewHireBranchContext = {
  vendor: NewHireVendorSource;
  chain: NewHireChainSource;
};

export type NewRequestDraft =
  | { type: "NEW_HIRE"; targetRole: NewHireTargetRole }
  | { type: "RESIGNATION" | "TRANSFER" };

export type InitialResignationPicker = {
  id: string;
  nameEn: string;
  phoneNumber?: string | null;
};
