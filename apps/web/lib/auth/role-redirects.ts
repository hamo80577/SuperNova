import { ROLE_REDIRECTS } from "@supernova/shared";

import type { SafeUser, UserRole } from "./types";

export function getRoleRedirect(role: UserRole) {
  return ROLE_REDIRECTS[role];
}

export function getUserRedirect(user: SafeUser) {
  if (user.mustChangePassword) {
    return "/change-password";
  }

  return getRoleRedirect(user.role);
}

export function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    PICKER: "Picker",
    CHAMP: "Champ",
    AREA_MANAGER: "Area Manager",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super Admin"
  };

  return labels[role];
}
