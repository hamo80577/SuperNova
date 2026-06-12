"use client";

import { AlertTriangle, CheckCircle2, Save, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ordersKpisApi,
  type OrdersKpiTargetSettingsResponse,
  type OrdersKpiTargetSettingsValues
} from "@/lib/api/orders-kpis";
import { cn } from "@/lib/utils";

type TargetFieldKey = keyof OrdersKpiTargetSettingsValues;
type TargetStatus = "idle" | "loading" | "saving" | "success" | "error";

const targetFields: Array<{
  description: string;
  key: TargetFieldKey;
  label: string;
}> = [
  {
    description: "Primary target. Rows above this UHO rate are Out of Target.",
    key: "uhoRateTarget",
    label: "UHO %"
  },
  {
    description: "Secondary warning threshold for late orders.",
    key: "notOnTimeRateTarget",
    label: "Not on Time %"
  },
  {
    description: "Secondary warning threshold for QC failed orders.",
    key: "qcFailedRateTarget",
    label: "QC Failed %"
  },
  {
    description: "Secondary warning threshold for partial refunds.",
    key: "partialRefundRateTarget",
    label: "Partial Refund %"
  },
  {
    description: "Secondary warning threshold for out-of-stock orders.",
    key: "oosRateTarget",
    label: "OOS %"
  },
  {
    description: "Secondary warning threshold for price modifications.",
    key: "priceModifiedRateTarget",
    label: "Price Modified %"
  }
];

export function OrdersKpiTargetSettingsPage() {
  const [settings, setSettings] = useState<OrdersKpiTargetSettingsResponse | null>(
    null
  );
  const [draft, setDraft] = useState<Record<TargetFieldKey, string>>(
    emptyTargetDraft()
  );
  const [status, setStatus] = useState<TargetStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setStatus("loading");
    setError(null);

    ordersKpisApi
      .targetSettings()
      .then((response) => {
        if (ignore) {
          return;
        }

        setSettings(response);
        setDraft(toTargetDraft(response.targets));
        setStatus("success");
      })
      .catch((caughtError: unknown) => {
        if (ignore) {
          return;
        }

        setError(getErrorMessage(caughtError));
        setStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, []);

  const validationError = useMemo(() => validateDraft(draft), [draft]);
  const hasChanges = useMemo(
    () =>
      settings
        ? targetFields.some(
            (field) => Number(draft[field.key]) !== settings.targets[field.key]
          )
        : false,
    [draft, settings]
  );
  const isLoading = status === "loading";
  const isSaving = status === "saving";

  function updateDraft(key: TargetFieldKey, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
    setMessage(null);
    setError(null);
  }

  async function saveTargets() {
    if (validationError || isSaving) {
      return;
    }

    setStatus("saving");
    setMessage(null);
    setError(null);

    try {
      const response = await ordersKpisApi.updateTargetSettings(toTargetRequest(draft));
      setSettings(response);
      setDraft(toTargetDraft(response.targets));
      setMessage("Orders KPI targets saved.");
      setStatus("success");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
      setStatus("error");
    }
  }

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal text-[color:var(--sn-ink)] sm:text-2xl">
                Orders KPI Targets
              </h1>
              <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
                Global percentage thresholds for Orders KPI performance status.
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              "w-fit rounded-xl px-3 py-1",
              settings?.source === "SAVED"
                ? "border-[oklch(0.8_0.07_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]"
                : "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] text-[color:var(--sn-body)]"
            )}
            variant="outline"
          >
            {settings?.source === "SAVED" ? "Saved targets" : "Default targets"}
          </Badge>
        </div>
      </section>

      {error ? <Notice message={error} tone="error" /> : null}
      {validationError ? <Notice message={validationError} tone="warning" /> : null}
      {message ? <Notice message={message} tone="success" /> : null}

      <section className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {targetFields.map((field) =>
            isLoading ? (
              <Skeleton className="h-32 rounded-2xl" key={field.key} />
            ) : (
              <label
                className={cn(
                  "min-w-0 rounded-2xl border bg-[color:var(--sn-sunken)] p-4",
                  field.key === "uhoRateTarget"
                    ? "border-primary/30 ring-1 ring-primary/10"
                    : "border-[color:var(--sn-border)]"
                )}
                key={field.key}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[color:var(--sn-ink)]">
                    {field.label}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--sn-muted)]">
                    Target &lt;=
                  </span>
                </span>
                <div className="relative mt-3">
                  <Input
                    className="h-12 rounded-xl pr-10 text-lg font-semibold tabular-nums"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    onChange={(event) => updateDraft(field.key, event.target.value)}
                    step="0.01"
                    type="number"
                    value={draft[field.key]}
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-sm font-semibold text-[color:var(--sn-muted)]">
                    %
                  </span>
                </div>
                <span className="mt-3 block text-sm leading-6 text-[color:var(--sn-muted)]">
                  {field.description}
                </span>
              </label>
            )
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[color:var(--sn-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm text-[color:var(--sn-muted)]">
            {settings?.updatedAt
              ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}`
              : "Defaults are used until an admin saves target settings."}
          </div>
          <Button
            className="h-11 gap-2 rounded-xl px-5"
            disabled={!hasChanges || Boolean(validationError) || isSaving || isLoading}
            onClick={() => void saveTargets()}
            type="button"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save targets"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Notice({
  message,
  tone
}: {
  message: string;
  tone: "error" | "success" | "warning";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-sm leading-6",
        tone === "success" && "border-[oklch(0.8_0.07_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        tone === "warning" && "border-[oklch(0.88_0.05_80)] bg-[oklch(0.95_0.05_80)] text-[oklch(0.62_0.13_70)]",
        tone === "error" && "border-[oklch(0.75_0.12_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-medium">{message}</p>
      </div>
    </div>
  );
}

function emptyTargetDraft(): Record<TargetFieldKey, string> {
  return {
    uhoRateTarget: "",
    notOnTimeRateTarget: "",
    qcFailedRateTarget: "",
    partialRefundRateTarget: "",
    oosRateTarget: "",
    priceModifiedRateTarget: ""
  };
}

function toTargetDraft(
  targets: OrdersKpiTargetSettingsValues
): Record<TargetFieldKey, string> {
  return {
    uhoRateTarget: String(targets.uhoRateTarget),
    notOnTimeRateTarget: String(targets.notOnTimeRateTarget),
    qcFailedRateTarget: String(targets.qcFailedRateTarget),
    partialRefundRateTarget: String(targets.partialRefundRateTarget),
    oosRateTarget: String(targets.oosRateTarget),
    priceModifiedRateTarget: String(targets.priceModifiedRateTarget)
  };
}

function toTargetRequest(
  draft: Record<TargetFieldKey, string>
): OrdersKpiTargetSettingsValues {
  return {
    uhoRateTarget: Number(draft.uhoRateTarget),
    notOnTimeRateTarget: Number(draft.notOnTimeRateTarget),
    qcFailedRateTarget: Number(draft.qcFailedRateTarget),
    partialRefundRateTarget: Number(draft.partialRefundRateTarget),
    oosRateTarget: Number(draft.oosRateTarget),
    priceModifiedRateTarget: Number(draft.priceModifiedRateTarget)
  };
}

function validateDraft(draft: Record<TargetFieldKey, string>) {
  for (const field of targetFields) {
    const value = Number(draft[field.key]);

    if (draft[field.key] === "" || !Number.isFinite(value)) {
      return `${field.label} target must be a number.`;
    }

    if (value < 0 || value > 100) {
      return `${field.label} target must be between 0 and 100%.`;
    }
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load Orders KPI target settings.";
}
