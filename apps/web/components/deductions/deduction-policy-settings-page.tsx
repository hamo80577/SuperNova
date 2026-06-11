"use client";

import { Loader2, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deductionPenaltyTypeLabels,
  deductionsApi,
  type ActiveDeductionPolicy,
  type DeductionActionStatus,
  type DeductionPenaltyType,
  type DeductionPolicyAction,
  type DeductionRuleStepInput
} from "@/lib/api/deductions";
import { cn } from "@/lib/utils";
import { formatDate, formatOrdinal } from "./deduction-format";

type PolicyState =
  | { status: "loading"; policy?: never; error?: never }
  | { status: "error"; error: string; policy?: never }
  | { status: "ready"; policy: ActiveDeductionPolicy; error?: never };

type RuleStepDraft = {
  penaltyType: DeductionPenaltyType;
  deductionDays: string;
  label: string;
  openEnded: boolean;
};

type ActionFormValues = {
  code: string;
  name: string;
  description: string;
  status: DeductionActionStatus;
  rules: RuleStepDraft[];
};

const MAX_RULE_STEPS = 20;
const ACTION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

const penaltyTypeOptions: DeductionPenaltyType[] = [
  "WARNING",
  "DEDUCTION_DAYS",
  "LIFECYCLE_REVIEW_REQUIRED"
];

export function DeductionPolicySettingsPage() {
  const [state, setState] = useState<PolicyState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });

    deductionsApi
      .activePolicy({ includeInactive: true })
      .then((policy) => {
        if (mounted) {
          setState({ policy, status: "ready" });
        }
      })
      .catch((caughtError) => {
        if (mounted) {
          setState({
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load the active deduction policy.",
            status: "error"
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  function handleSaved(message: string) {
    setSuccessMessage(message);
    setCreating(false);
    setRefreshToken((current) => current + 1);
  }

  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="grid gap-4" role="status">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-3 h-4 w-64" />
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
        {state.error}
      </div>
    );
  }

  const { policy } = state;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <Badge
              className="border-slate-200 bg-slate-50 text-slate-700"
              variant="outline"
            >
              Version {policy.versionNumber}
            </Badge>
            <Badge
              className="border-emerald-200 bg-emerald-50 text-emerald-700"
              variant="outline"
            >
              Active
            </Badge>
          </div>
          <Button
            className="h-10 rounded-xl"
            onClick={() => {
              setSuccessMessage(null);
              setCreating((current) => !current);
            }}
            type="button"
            variant={creating ? "outline" : "default"}
          >
            <Plus className="mr-2 h-4 w-4" />
            New action
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Effective from{" "}
          <span className="font-semibold text-slate-950">
            {formatDate(policy.effectiveFrom)}
          </span>{" "}
          ·{" "}
          <span className="font-semibold text-slate-950">
            {policy.actions.length}
          </span>{" "}
          {policy.actions.length === 1 ? "action" : "actions"}
        </p>
      </section>

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {creating ? (
        <PolicyActionForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={handleSaved}
          title="New action"
        />
      ) : null}

      {policy.actions.map((action) => (
        <PolicyActionCard
          action={action}
          key={action.id}
          onEditingChange={() => setSuccessMessage(null)}
          onSaved={handleSaved}
        />
      ))}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Editing active deduction rules affects future tickets only. Historical
        deduction records keep the rule snapshot captured when the ticket was
        submitted and approved.
      </div>
    </div>
  );
}

function PolicyActionCard({
  action,
  onEditingChange,
  onSaved
}: {
  action: DeductionPolicyAction;
  onEditingChange: () => void;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PolicyActionForm
        actionId={action.id}
        initial={toFormValues(action)}
        mode="edit"
        onCancel={() => setEditing(false)}
        onSaved={(message) => {
          setEditing(false);
          onSaved(message);
        }}
        title={`Edit ${action.name}`}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">{action.name}</h3>
          <Badge
            className="border-slate-200 bg-slate-50 text-slate-600"
            variant="outline"
          >
            {action.code}
          </Badge>
        </div>
        <Button
          className="h-9 rounded-xl"
          onClick={() => {
            onEditingChange();
            setEditing(true);
          }}
          type="button"
          variant="outline"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>
      {action.description ? (
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {action.description}
        </p>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {action.ruleSteps.map((step) => (
          <li
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            key={step.id}
          >
            <Badge
              className="shrink-0 border-slate-200 bg-white text-slate-700"
              variant="outline"
            >
              {formatOrdinal(step.occurrenceNumber)}
              {step.appliesFromOccurrence !== null ? "+" : ""}
            </Badge>
            <span className="text-sm text-slate-700">→ {step.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PolicyActionForm({
  actionId,
  initial,
  mode,
  onCancel,
  onSaved,
  title
}: {
  actionId?: string;
  initial?: ActionFormValues;
  mode: "create" | "edit";
  onCancel: () => void;
  onSaved: (message: string) => void;
  title: string;
}) {
  const [values, setValues] = useState<ActionFormValues>(
    initial ?? emptyFormValues()
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateRule(index: number, patch: Partial<RuleStepDraft>) {
    setValues((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule
      )
    }));
  }

  function addRule() {
    setValues((current) => {
      if (current.rules.length >= MAX_RULE_STEPS) {
        return current;
      }

      return {
        ...current,
        rules: [
          // Only the last rule can be open-ended, so clear the flag on the
          // previously-last row before appending.
          ...current.rules.map((rule) => ({ ...rule, openEnded: false })),
          emptyRuleDraft()
        ]
      };
    });
  }

  function removeLastRule() {
    setValues((current) =>
      current.rules.length > 1
        ? { ...current, rules: current.rules.slice(0, -1) }
        : current
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = values.code.trim().toUpperCase();
    const name = values.name.trim();
    const description = values.description.trim();

    if (mode === "create" && !ACTION_CODE_PATTERN.test(code)) {
      setError(
        "Code must be UPPER_SNAKE_CASE (letters, digits, underscores; 2-50 characters)."
      );
      return;
    }

    if (name.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    const ruleSteps: DeductionRuleStepInput[] = [];

    for (const [index, rule] of values.rules.entries()) {
      const label = rule.label.trim();

      if (!label) {
        setError(`Rule ${index + 1} needs a label.`);
        return;
      }

      const step: DeductionRuleStepInput = {
        label,
        occurrenceNumber: index + 1,
        penaltyType: rule.penaltyType
      };

      if (rule.penaltyType === "DEDUCTION_DAYS") {
        const days = Number(rule.deductionDays);

        if (!rule.deductionDays || !Number.isFinite(days) || days <= 0) {
          setError(`Rule ${index + 1} needs deduction days greater than 0.`);
          return;
        }

        if (days > 31) {
          setError(`Rule ${index + 1} cannot deduct more than 31 days.`);
          return;
        }

        step.deductionDays = days;
      }

      if (rule.openEnded && index === values.rules.length - 1) {
        step.appliesFromOccurrence = index + 1;
      }

      ruleSteps.push(step);
    }

    setError(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        await deductionsApi.createPolicyAction({
          code,
          name,
          ruleSteps,
          ...(description ? { description } : {})
        });
        onSaved(
          `Action "${name}" created. It applies to new tickets immediately.`
        );
      } else if (actionId) {
        await deductionsApi.updatePolicyAction(actionId, {
          description,
          name,
          ruleSteps,
          status: values.status
        });
        onSaved(
          `Action "${name}" saved. Changes apply to new tickets immediately.`
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the action."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-white p-4">
      <form className="grid gap-4" onSubmit={submit}>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {mode === "create" ? (
            <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
              Code
              <Input
                className="h-11 rounded-xl uppercase"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase()
                  }))
                }
                placeholder="LATE_ATTENDANCE"
                required
                value={values.code}
              />
            </label>
          ) : null}
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
            Name
            <Input
              className="h-11 rounded-xl"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Late attendance"
              required
              value={values.name}
            />
          </label>
          {mode === "edit" ? (
            <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
              Status
              <Select
                aria-label="Action status"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    status: event.target.value as DeductionActionStatus
                  }))
                }
                value={values.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </label>
          ) : null}
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
            Description
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={500}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              placeholder="Optional description shown to ticket creators."
              value={values.description}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-slate-600">Rules</p>
          {values.rules.map((rule, index) => (
            <RuleStepEditor
              isLast={index === values.rules.length - 1}
              key={index}
              occurrenceNumber={index + 1}
              onChange={(patch) => updateRule(index, patch)}
              rule={rule}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-9 rounded-xl"
              disabled={values.rules.length >= MAX_RULE_STEPS}
              onClick={addRule}
              type="button"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add rule
            </Button>
            <Button
              className="h-9 rounded-xl"
              disabled={values.rules.length <= 1}
              onClick={removeLastRule}
              type="button"
              variant="outline"
            >
              Remove last rule
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            className="h-11 rounded-xl"
            disabled={submitting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button className="h-11 rounded-xl" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create action" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function RuleStepEditor({
  isLast,
  occurrenceNumber,
  onChange,
  rule
}: {
  isLast: boolean;
  occurrenceNumber: number;
  onChange: (patch: Partial<RuleStepDraft>) => void;
  rule: RuleStepDraft;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className="shrink-0 border-slate-200 bg-white text-slate-700"
          variant="outline"
        >
          {formatOrdinal(occurrenceNumber)}
          {rule.openEnded && isLast ? "+" : ""}
        </Badge>
        <span className="text-xs font-medium text-slate-500">
          Occurrence {occurrenceNumber}
          {rule.openEnded && isLast ? " and later" : ""}
        </span>
      </div>
      <div
        className={cn(
          "grid gap-2",
          rule.penaltyType === "DEDUCTION_DAYS"
            ? "sm:grid-cols-[minmax(0,1fr)_96px_minmax(0,1.4fr)]"
            : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        )}
      >
        <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
          Penalty type
          <Select
            aria-label={`Penalty type for occurrence ${occurrenceNumber}`}
            onChange={(event) =>
              onChange({
                penaltyType: event.target.value as DeductionPenaltyType
              })
            }
            value={rule.penaltyType}
          >
            {penaltyTypeOptions.map((penaltyType) => (
              <option key={penaltyType} value={penaltyType}>
                {deductionPenaltyTypeLabels[penaltyType]}
              </option>
            ))}
          </Select>
        </label>
        {rule.penaltyType === "DEDUCTION_DAYS" ? (
          <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
            Days
            <Input
              aria-label={`Deduction days for occurrence ${occurrenceNumber}`}
              className="h-11 rounded-xl"
              max={31}
              min={0.1}
              onChange={(event) =>
                onChange({ deductionDays: event.target.value })
              }
              step="any"
              type="number"
              value={rule.deductionDays}
            />
          </label>
        ) : null}
        <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
          Label
          <Input
            aria-label={`Label for occurrence ${occurrenceNumber}`}
            className="h-11 rounded-xl"
            maxLength={80}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="Verbal warning"
            value={rule.label}
          />
        </label>
      </div>
      {isLast ? (
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            checked={rule.openEnded}
            className="h-4 w-4 rounded border-slate-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            onChange={(event) => onChange({ openEnded: event.target.checked })}
            type="checkbox"
          />
          Applies to all later occurrences ({formatOrdinal(occurrenceNumber)}+)
        </label>
      ) : null}
    </div>
  );
}

function toFormValues(action: DeductionPolicyAction): ActionFormValues {
  return {
    code: action.code,
    description: action.description ?? "",
    name: action.name,
    rules: action.ruleSteps.map((step) => ({
      deductionDays:
        step.deductionDays === null ? "" : String(Number(step.deductionDays)),
      label: step.label,
      openEnded: step.appliesFromOccurrence !== null,
      penaltyType: step.penaltyType
    })),
    status: action.status
  };
}

function emptyFormValues(): ActionFormValues {
  return {
    code: "",
    description: "",
    name: "",
    rules: [emptyRuleDraft()],
    status: "ACTIVE"
  };
}

function emptyRuleDraft(): RuleStepDraft {
  return {
    deductionDays: "",
    label: "",
    openEnded: false,
    penaltyType: "WARNING"
  };
}
