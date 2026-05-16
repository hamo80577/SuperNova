"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import type { UiTheme } from "@/lib/auth/types";
import {
  isUiTheme,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  type ThemePreset
} from "@/lib/theme";

interface ThemeContextValue {
  presets: ThemePreset[];
  setTheme: (theme: UiTheme) => void;
  theme: UiTheme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<UiTheme>("ORANGE");

  const applyTheme = useCallback((nextTheme: UiTheme) => {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(isUiTheme(storedTheme) ? storedTheme : "ORANGE");
  }, [applyTheme]);

  useEffect(() => {
    if (user?.uiTheme) {
      applyTheme(user.uiTheme);
    }
  }, [applyTheme, user?.uiTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      presets: THEME_PRESETS,
      setTheme: applyTheme,
      theme
    }),
    [applyTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
