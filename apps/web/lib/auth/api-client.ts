import type { AuthResponse } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message ?? body.error ?? "Request failed.";
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  login(phoneNumber: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phoneNumber, password })
    });
  },
  logout() {
    return request<{ success: true }>("/auth/logout", {
      method: "POST"
    });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<AuthResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },
  me() {
    return request<AuthResponse>("/auth/me");
  }
};
