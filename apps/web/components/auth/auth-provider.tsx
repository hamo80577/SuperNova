"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { authApi } from "@/lib/auth/api-client";
import { getUserRedirect } from "@/lib/auth/role-redirects";
import type { AuthResponse, SafeUser } from "@/lib/auth/types";
import { clearApiCache } from "@/lib/api/request";
import { showGlobalLoading } from "@/lib/navigation-loading";

interface AuthContextValue {
  user: SafeUser | null;
  loading: boolean;
  login: (
    phoneNumber: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<AuthResponse>;
  refresh: () => Promise<AuthResponse | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await authApi.me();
      setUser(response.user);
      return response;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(phoneNumber, password, rememberMe = false) {
        clearApiCache();
        const response = await authApi.login(phoneNumber, password, rememberMe);
        setUser(response.user);
        return response;
      },
      async logout() {
        showGlobalLoading("Signing out");
        try {
          await authApi.logout();
        } finally {
          clearApiCache();
          setUser(null);
          window.location.assign("/login");
        }
      },
      async changePassword(currentPassword, newPassword) {
        clearApiCache();
        const response = await authApi.changePassword(
          currentPassword,
          newPassword
        );
        setUser(response.user);
        return response;
      },
      refresh
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

export function redirectForUser(user: SafeUser) {
  return getUserRedirect(user);
}
