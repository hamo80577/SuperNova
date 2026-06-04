import type { UserRole } from "@/lib/auth/types";
import type { UsersSectionId } from "./users-area-types";

export const usersManagementRoles: UserRole[] = [
  "AREA_MANAGER",
  "ADMIN",
  "SUPER_ADMIN"
];

export function isAdminUsersRole(
  role: UserRole | undefined
): role is "ADMIN" | "SUPER_ADMIN" {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function getVisibleUserSections(role: UserRole | undefined) {
  if (role === "CHAMP") {
    return [
      {
        id: "pickers" as const,
        label: "My Pickers",
        subtitle: "Active workforce"
      }
    ];
  }

  if (role === "AREA_MANAGER") {
    return [
      {
        id: "pickers" as const,
        label: "My Pickers",
        subtitle: "Active workforce"
      },
      {
        id: "champs" as const,
        label: "My Champs",
        subtitle: "Branch leaders"
      }
    ];
  }

  if (isAdminUsersRole(role)) {
    return [
      {
        id: "pickers" as const,
        label: "All Pickers",
        subtitle: "Active workforce"
      },
      {
        id: "champs" as const,
        label: "All Champs",
        subtitle: "Branch leaders"
      },
      {
        id: "management" as const,
        label: "Management Users",
        subtitle: "Admins & Area Managers"
      }
    ];
  }

  return [];
}

export function isRoleAllowedInUsersSection(
  section: UsersSectionId,
  role: UserRole
) {
  if (section === "pickers") {
    return role === "PICKER";
  }

  if (section === "champs") {
    return role === "CHAMP";
  }

  return usersManagementRoles.includes(role);
}

export function keepUsersSectionItems<T extends { user: { role: UserRole } }>(
  section: UsersSectionId,
  items: T[]
) {
  return items.filter((item) =>
    isRoleAllowedInUsersSection(section, item.user.role)
  );
}

export function getUsersSectionLabel(
  section: UsersSectionId,
  viewerRole: UserRole | undefined
) {
  const visible = getVisibleUserSections(viewerRole);
  return visible.find((item) => item.id === section)?.label ?? "Users";
}
