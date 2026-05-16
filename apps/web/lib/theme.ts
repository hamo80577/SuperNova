import type { UiTheme } from "@/lib/auth/types";

export const THEME_STORAGE_KEY = "supernova-ui-theme";

export type ThemePreset = {
  description: string;
  label: string;
  swatchClassName: string;
  value: UiTheme;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    value: "ORANGE",
    label: "Nova Orange",
    description: "Warm operational accent.",
    swatchClassName: "bg-[#ff5a00]"
  },
  {
    value: "TEAL",
    label: "Calm Teal",
    description: "Balanced and focused.",
    swatchClassName: "bg-[#0f8f8a]"
  },
  {
    value: "BLUE",
    label: "Clear Blue",
    description: "Crisp and structured.",
    swatchClassName: "bg-[#2563eb]"
  },
  {
    value: "EMERALD",
    label: "Soft Emerald",
    description: "Steady and fresh.",
    swatchClassName: "bg-[#059669]"
  },
  {
    value: "VIOLET",
    label: "Quiet Violet",
    description: "Soft control-room tone.",
    swatchClassName: "bg-[#7c3aed]"
  },
  {
    value: "SLATE",
    label: "Neutral Slate",
    description: "Low-chroma and calm.",
    swatchClassName: "bg-[#475569]"
  }
];

export function isUiTheme(value: unknown): value is UiTheme {
  return (
    value === "ORANGE" ||
    value === "TEAL" ||
    value === "BLUE" ||
    value === "EMERALD" ||
    value === "VIOLET" ||
    value === "SLATE"
  );
}
