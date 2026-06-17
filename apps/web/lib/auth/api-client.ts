import type { AuthResponse } from "./types";
import { apiRequest } from "@/lib/api/request";

export const authApi = {
  login(nationalId: string, password: string, rememberMe = false) {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ nationalId, password, rememberMe })
    });
  },
  logout() {
    return apiRequest<{ success: true }>("/auth/logout", {
      method: "POST"
    });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<AuthResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },
  me() {
    return apiRequest<AuthResponse>("/auth/me");
  }
};
