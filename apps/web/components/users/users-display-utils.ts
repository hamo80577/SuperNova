import type { OperationalProfileResponse } from "@/lib/api/users";
import type { VendorSummary } from "@/lib/api/workspaces";
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

export type UserOperationalStatus = {
  label: "Active" | "Pending" | "Resigned";
  tone: "active" | "pending" | "resigned";
  title: string;
};

export function getUserOperationalStatus(
  item: UsersAreaItem
): UserOperationalStatus {
  if (item.pendingRequest) {
    return {
      label: "Pending",
      tone: "pending",
      title: `${formatEnum(item.pendingRequest.type)} request in progress`
    };
  }

  if (
    item.user.employmentStatus === "RESIGNED" ||
    item.user.employmentStatus === "ARCHIVED" ||
    item.user.accountStatus === "ARCHIVED"
  ) {
    return {
      label: "Resigned",
      tone: "resigned",
      title: "Resignation confirmed"
    };
  }

  if (requiresAssignmentForActiveStatus(item.user.role)) {
    return item.assignment?.status === "ACTIVE"
      ? {
          label: "Active",
          tone: "active",
          title: "Active operational assignment"
        }
      : {
          label: "Pending",
          tone: "pending",
          title: "No active operational assignment"
        };
  }

  return item.user.accountStatus === "ACTIVE" &&
    item.user.employmentStatus === "ACTIVE"
    ? {
        label: "Active",
        tone: "active",
        title: "Active user account"
      }
    : {
        label: "Pending",
        tone: "pending",
        title: "User is not active yet"
      };
}

export function getProfileOperationalStatus(
  profile: OperationalProfileResponse
): UserOperationalStatus {
  const user = profile.user;
  const hasPendingLifecycleRequest = profile.recentRequests.some(
    (request) =>
      (request.type === "TRANSFER" || request.type === "RESIGNATION") &&
      request.status !== "COMPLETED" &&
      request.status !== "REJECTED" &&
      request.status !== "CANCELLED"
  );

  if (hasPendingLifecycleRequest) {
    return {
      label: "Pending",
      tone: "pending",
      title: "Transfer or Resignation request in progress"
    };
  }

  if (
    user.employmentStatus === "RESIGNED" ||
    user.employmentStatus === "ARCHIVED" ||
    user.accountStatus === "ARCHIVED"
  ) {
    return {
      label: "Resigned",
      tone: "resigned",
      title: "Resignation confirmed"
    };
  }

  if (user.role === "PICKER") {
    return profile.currentPickerAssignment?.status === "ACTIVE"
      ? {
          label: "Active",
          tone: "active",
          title: "Active Branch assignment"
        }
      : {
          label: "Pending",
          tone: "pending",
          title: "No active Branch assignment"
        };
  }

  if (user.role === "CHAMP") {
    return profile.champAssignments.some((assignment) => assignment.status === "ACTIVE")
      ? {
          label: "Active",
          tone: "active",
          title: "Active Branch ownership"
        }
      : {
          label: "Pending",
          tone: "pending",
          title: "No active Branch ownership"
        };
  }

  if (user.role === "AREA_MANAGER") {
    return profile.areaManagerAssignments.some(
      (assignment) => assignment.status === "ACTIVE"
    )
      ? {
          label: "Active",
          tone: "active",
          title: "Active Chain assignment"
        }
      : {
          label: "Pending",
          tone: "pending",
          title: "No active Chain assignment"
        };
  }

  return user.accountStatus === "ACTIVE" && user.employmentStatus === "ACTIVE"
    ? {
        label: "Active",
        tone: "active",
        title: "Active user account"
      }
    : {
        label: "Pending",
        tone: "pending",
        title: "User is not active yet"
      };
}

function requiresAssignmentForActiveStatus(role: string) {
  return role === "PICKER" || role === "CHAMP" || role === "AREA_MANAGER";
}

export function normalizePhoneForWhatsapp(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  return digits;
}
