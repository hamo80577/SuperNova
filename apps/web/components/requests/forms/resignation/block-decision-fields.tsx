"use client";

import { Input } from "@/components/ui/input";
import {
  type OffboardingBlockDecision,
  offboardingBlockDecisionLabels
} from "@/lib/api/requests";
import { cn } from "@/lib/utils";

import { offboardingBlockDecisions } from "../../shared/request-constants";
import { Field } from "../../shared/request-field";

export function BlockDecisionFields({
  blockDecision,
  blockReason,
  onChange,
  title
}: {
  blockDecision: OffboardingBlockDecision | "";
  blockReason: string;
  onChange: (
    patch: Partial<{
      blockDecision: OffboardingBlockDecision;
      blockReason: string;
    }>
  ) => void;
  title: string;
}) {
  return (
    <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Area Manager chooses either no block or a permanent block before
          Admin confirmation.
        </p>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {offboardingBlockDecisions.map((decision) => (
            <button
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-medium transition",
                blockDecision === decision
                  ? "border-orange-300 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
              )}
              key={decision}
              onClick={() =>
                onChange({
                  blockDecision: decision,
                  blockReason: decision === "NO_BLOCK" ? "" : blockReason
                })
              }
              type="button"
            >
              {offboardingBlockDecisionLabels[decision]}
            </button>
          ))}
        </div>
        {blockDecision === "PERMANENT" ? (
          <Field label="Block reason">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => onChange({ blockReason: event.target.value })}
              placeholder="Required for Permanent block"
              value={blockReason}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
