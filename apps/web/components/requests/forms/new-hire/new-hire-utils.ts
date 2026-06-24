import { type Dispatch, type SetStateAction } from "react";
import { type NewHireLookupCandidate, type NewHireTargetRole } from "@/lib/api/requests";
import { type UserRole } from "@/lib/auth/types";
import { type NewHireChainOption, type NewHireChainSource, type NewHireEntityStatus, type NewHireVendorOption, type NewHireVendorSource } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

export function toNewHireChainOption(chain: NewHireChainSource): NewHireChainOption {
  return {
    id: chain.id,
    chainName: chain.chainName,
    chainCode: chain.chainCode,
    status: chain.status ?? "ACTIVE"
  };
}

export function toNewHireVendorOption(
  vendor: NewHireVendorSource,
  chain?: NewHireChainSource
): NewHireVendorOption {
  const resolvedChain = toNewHireChainOption(
    chain ??
      vendor.chain ?? {
        id: vendor.chainId,
        chainName: "Selected Chain",
        chainCode: "",
        status: "ACTIVE"
      }
  );

  return {
    id: vendor.id,
    vendorName: vendor.vendorName,
    vendorCode: vendor.vendorCode,
    vendorExternalId: vendor.vendorExternalId ?? null,
    status: vendor.status ?? "ACTIVE",
    chainId: vendor.chainId,
    area: vendor.area ?? null,
    city: vendor.city ?? null,
    chain: resolvedChain
  };
}

export function uniqueNewHireChains(chains: NewHireChainOption[]) {
  return Array.from(new Map(chains.map((chain) => [chain.id, chain])).values());
}

export function isActiveNewHireEntity(entity: { status?: NewHireEntityStatus }) {
  return !entity.status || entity.status === "ACTIVE";
}

export function applyFixedNewHireBranch(
  fixedSourceVendorId: string | undefined,
  vendorOptions: NewHireVendorOption[],
  setForm: Dispatch<
    SetStateAction<{
      targetRole: NewHireTargetRole;
      sourceChainId: string;
      sourceVendorId: string;
      firstNameEn: string;
      secondNameEn: string;
      thirdNameEn: string;
      nameAr: string;
      phoneNumber: string;
      nationalId: string;
      actualJoiningDate: string;
      dateOfBirth: string;
      gender: "MALE" | "FEMALE" | "UNSPECIFIED";
      address: string;
      notes: string;
      shopperId: string;
    }>
  >
) {
  if (!fixedSourceVendorId) {
    return;
  }

  const fixedVendor = vendorOptions.find((vendor) => vendor.id === fixedSourceVendorId);
  setForm((current) => ({
    ...current,
    sourceVendorId: fixedSourceVendorId,
    sourceChainId: fixedVendor?.chainId ?? current.sourceChainId
  }));
}

export function getAllowedNewHireTargetRoles(
  role: UserRole | undefined,
  branchLocked: boolean
): NewHireTargetRole[] {
  if (role === "CHAMP") {
    return ["PICKER"];
  }
  if (role === "AREA_MANAGER") {
    return ["PICKER", "CHAMP"];
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return branchLocked ? ["PICKER", "CHAMP"] : ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

export function isValidEgyptPhone(value: string) {
  return /^(010|011|012|015)\d{8}$/.test(value);
}

export function isValidEgyptNationalId(value: string) {
  return /^\d{14}$/.test(value);
}

export function isBlockingNewHireDecision(decision: NewHireLookupCandidate["decision"]) {
  return (
    decision === "ACTIVE_DUPLICATE" ||
    decision === "BLOCKED" ||
    decision === "TEMPORARY_BLOCKED" ||
    decision === "PERMANENT_BLOCKED"
  );
}

export function getNewHireSubmitLabel(targetRole: NewHireTargetRole) {
  if (targetRole === "AREA_MANAGER") {
    return "Submit Area Manager New Hire";
  }
  return `Submit ${formatEnum(targetRole)} New Hire`;
}

export function buildNewHireApprovalSteps(
  creatorRole: UserRole | undefined,
  targetRole: NewHireTargetRole
) {
  if (targetRole === "AREA_MANAGER") {
    return [
      {
        label: "Submit",
        description: "Admin submits the Area Manager New Hire.",
        skipped: false
      },
      {
        label: "Admin finalization",
        description: "Admin finalizes the request before the Area Manager account is created.",
        skipped: false
      },
      {
        label: "Profile Chain assignment",
        description: "Admin assigns Chains later from the Area Manager profile.",
        skipped: false
      },
      {
        label: "Credential handoff from user profile",
        description: "Temporary password is revealed or reset only from authorized profile controls.",
        skipped: false
      }
    ];
  }

  const isAreaManagerCreator = creatorRole === "AREA_MANAGER";
  const finalization =
    targetRole === "PICKER"
      ? "Admin final approval"
      : "Admin finalization";
  const assignment =
    targetRole === "PICKER"
      ? "Picker created and assigned"
      : "Champ created and assigned to Branch";

  return [
    {
      label: "Submit",
      description: `${formatEnum(targetRole)} New Hire request is submitted.`,
      skipped: false
    },
    {
      label: "Area Manager approval",
      description: isAreaManagerCreator
        ? "Area Manager-created New Hire skips this approval step."
        : "Area Manager reviews the Branch-scoped request.",
      skipped: isAreaManagerCreator
    },
    {
      label: finalization,
      description:
        targetRole === "PICKER"
          ? "Admin approves after Area Manager Shopper ID capture."
          : "Admin finalizes without a Shopper ID.",
      skipped: false
    },
    {
      label: assignment,
      description:
        targetRole === "PICKER"
          ? "PickerBranchAssignment is created."
          : "VendorChampAssignment is created.",
      skipped: false
    }
  ];
}

export function maskNationalId(value: string) {
  if (value.length <= 4) {
    return value;
  }
  return `${value.slice(0, 3)}*******${value.slice(-4)}`;
}
