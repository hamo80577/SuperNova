import type { OperationalProfileResponse } from "@/lib/api/users";
import type { UserSummary, VendorSummary } from "@/lib/api/workspaces";
import type { SafeUser } from "@/lib/auth/types";
import type { UsersAreaItem } from "./users-area-types";

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getPrimaryAssignmentLabel(profile: OperationalProfileResponse) {
  if (profile.currentPickerAssignment?.vendor) {
    return profile.currentPickerAssignment.vendor.vendorName;
  }
  if (profile.champAssignments[0]?.vendor) {
    return profile.champAssignments[0].vendor!.vendorName;
  }
  if (profile.areaManagerAssignments[0]?.chain) {
    return profile.areaManagerAssignments[0].chain.chainName;
  }
  return "No active assignment";
}

export function getProfileChainLabel(profile: OperationalProfileResponse) {
  if (profile.currentPickerAssignment?.chain) {
    return profile.currentPickerAssignment.chain.chainName;
  }
  if (profile.champAssignments[0]?.chain) {
    return profile.champAssignments[0].chain.chainName;
  }
  if (profile.areaManagerAssignments[0]?.chain) {
    return profile.areaManagerAssignments[0].chain.chainName;
  }
  return "Not assigned";
}

export function getItemBranch(item: UsersAreaItem): VendorSummary | null {
  return item.vendor ?? null;
}

export function getItemChainName(item: UsersAreaItem) {
  return item.chain?.chainName ?? item.vendor?.chain?.chainName ?? "";
}

export function getContextNote(item: UsersAreaItem) {
  if (item.user.role === "AREA_MANAGER") {
    return item.chain?.chainName
      ? "Chain assignment"
      : "Open profile for assigned Chains.";
  }
  if (item.user.role === "CHAMP") {
    return item.vendor || item.chain
      ? "Branch ownership"
      : "Open profile for Branch context.";
  }
  return item.vendor || item.chain
    ? "Current assignment"
    : "Open profile for assignment context.";
}

export function getSafeUserIds(user: UserSummary | SafeUser) {
  return {
    ibsId: "ibsId" in user ? user.ibsId : null,
    shopperId: "shopperId" in user ? user.shopperId : null
  };
}

export function normalizePhoneForWhatsapp(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  return digits;
}
