"use client";

import { Check, Palette, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { PageHeaderSkeleton, StatsCardSkeleton } from "@/components/ui/skeleton";
import { usersApi } from "@/lib/api/users";
import type { UiTheme } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

export function AppearanceSettingsPage() {
  const { loading, refresh, user } = useAuth();
  const { presets, setTheme, theme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<UiTheme>(theme);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uiTheme) {
      setSelectedTheme(user.uiTheme);
    }
  }, [user?.uiTheme]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.value === selectedTheme) ?? presets[0],
    [presets, selectedTheme]
  );
  const hasChanges = Boolean(user?.uiTheme && selectedTheme !== user.uiTheme);

  function previewTheme(nextTheme: UiTheme) {
    setSelectedTheme(nextTheme);
    setTheme(nextTheme);
    setMessage(null);
    setError(null);
  }

  async function savePreferences() {
    if (!user || saving) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await usersApi.updatePreferences({
        uiTheme: selectedTheme
      });
      setTheme(response.user.uiTheme);
      await refresh();
      setMessage("Appearance preference saved.");
    } catch (caughtError) {
      const fallbackTheme = user.uiTheme;
      setSelectedTheme(fallbackTheme);
      setTheme(fallbackTheme);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save appearance preference."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="grid gap-4">
        <PageHeaderSkeleton />
        <StatsCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Palette className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                  Appearance
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Choose a calm accent color for your SuperNova workspace.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Current:{" "}
            <span className="font-semibold text-slate-950">
              {selectedPreset.label}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => {
            const selected = preset.value === selectedTheme;

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "group flex min-h-[112px] items-start gap-3 rounded-2xl border bg-white p-4 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-primary/25 motion-reduce:transform-none",
                  selected
                    ? "border-primary/50 bg-primary/5 shadow-[0_10px_26px_rgba(15,23,42,0.08)]"
                    : "border-slate-200"
                )}
                key={preset.value}
                onClick={() => previewTheme(preset.value)}
                type="button"
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm",
                    preset.swatchClassName
                  )}
                >
                  {selected ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-950">
                    {preset.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-500">
                    {preset.description}
                  </span>
                  <span className="mt-3 flex gap-1.5">
                    <span className="h-2 flex-1 rounded-full bg-primary" />
                    <span className="h-2 flex-1 rounded-full bg-primary/35" />
                    <span className="h-2 flex-1 rounded-full bg-slate-200" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm">
            {message ? <span className="text-emerald-700">{message}</span> : null}
            {error ? <span className="text-destructive">{error}</span> : null}
            {!message && !error ? (
              <span className="text-slate-500">
                The selected theme follows you across roles after it is saved.
              </span>
            ) : null}
          </div>
          <Button
            className="h-11 rounded-xl px-5"
            disabled={!hasChanges || saving}
            onClick={() => void savePreferences()}
            type="button"
          >
            {saving ? "Saving..." : "Save theme"}
          </Button>
        </div>
      </section>
    </div>
  );
}
