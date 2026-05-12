"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import {
  type ChampBranchDetail,
  type UserSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

type OffboardingType = "RESIGNATION";
type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const offboardingSchema = z.object({
  targetUserId: z.string().uuid("Select an active Picker from this Branch."),
  reason: z.string().trim().min(3, "Reason is required.").max(1000),
  effectiveDate: z.string().min(1, "Effective date is required."),
  notes: z.string().trim().max(1000).optional()
});

type OffboardingFormValues = z.infer<typeof offboardingSchema>;

export function ChampOffboardingForm({ type }: { type: OffboardingType }) {
  const params = useParams<{ vendorId: string }>();
  const [preselectedPickerId, setPreselectedPickerId] = useState<string | null>(
    null
  );
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
  });
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch
  } = useForm<OffboardingFormValues>({
    resolver: zodResolver(offboardingSchema)
  });

  useEffect(() => {
    setPreselectedPickerId(
      new URLSearchParams(window.location.search).get("pickerId")
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBranch() {
      try {
        const branch = await workspacesApi.champBranchDetail(params.vendorId);
        if (mounted) {
          setBranchState({ status: "ready", data: branch });
        }
      } catch (caughtError) {
        if (mounted) {
          setBranchState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Branch context."
          });
        }
      }
    }

    void loadBranch();

    return () => {
      mounted = false;
    };
  }, [params.vendorId]);

  useEffect(() => {
    if (
      branchState.status === "ready" &&
      preselectedPickerId &&
      branchState.data.pickers.some((item) => item.picker.id === preselectedPickerId)
    ) {
      setValue("targetUserId", preselectedPickerId);
    }
  }, [branchState, preselectedPickerId, setValue]);

  const selectedPickerId = watch("targetUserId");
  const selectedPicker = useMemo(() => {
    if (branchState.status !== "ready") {
      return null;
    }

    return (
      branchState.data.pickers.find((item) => item.picker.id === selectedPickerId)
        ?.picker ?? null
    );
  }, [branchState, selectedPickerId]);

  function onSubmit(values: OffboardingFormValues) {
    startTransition(async () => {
      setSubmitError(null);
      try {
        const created = await requestsApi.createOffboarding({
          type,
          sourceVendorId: params.vendorId,
          targetUserId: values.targetUserId,
          reason: values.reason,
          resignationDate: values.effectiveDate,
          ...(values.notes ? { notes: values.notes } : {})
        });
        setCreatedRequest(created);
      } catch (caughtError) {
        setSubmitError(
          caughtError instanceof Error
            ? caughtError.message
            : `Unable to submit ${formatEnum(type)} request.`
        );
      }
    });
  }

  if (branchState.status === "loading") {
    return <LoadingState label="Loading selected Branch context" />;
  }

  if (branchState.status === "error") {
    return <ErrorState message={branchState.error} />;
  }

  const branch = branchState.data;
  const title = formatEnum(type);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <Link
          className="mb-4 inline-flex items-center text-sm font-medium text-primary"
          href={`/champ/branches/${branch.vendor.id}`}
          prefetch
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Branch workspace
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-destructive/40 text-destructive" variant="outline">
              Branch-first offboarding
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Submit {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              This request runs inside the selected Branch context. Pickers are
              limited to active assignments in this Branch; Admin finalization
              applies account archival, block status, and assignment closure.
            </p>
          </div>
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ContextCard branch={branch} />
        <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold">{title} request details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is not a direct edit. The Area Manager approves first, then an
            Admin must confirm internal deactivation and block status.
          </p>

          {createdRequest ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium">{title} request submitted.</p>
                  <p className="mt-1">
                    Status: {formatEnum(createdRequest.status)}. Current step:{" "}
                    {createdRequest.currentStep
                      ? formatEnum(createdRequest.currentStep)
                      : "None"}.
                  </p>
                  <Link
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "mt-3 bg-white"
                    )}
                    href={`/tickets?requestId=${createdRequest.id}`}
                    prefetch
                  >
                    Open request detail
                  </Link>
                </div>
              </div>
            </div>
          ) : branch.pickers.length ? (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <Field error={errors.targetUserId?.message} label="Active Picker">
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  {...register("targetUserId")}
                >
                  <option value="">Select Picker</option>
                  {branch.pickers.map(({ picker }) => (
                    <option key={picker.id} value={picker.id}>
                      {picker.nameEn} · {picker.phoneNumber}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.reason?.message} label="Reason">
                  <Input
                    placeholder="Example: Picker submitted resignation"
                    {...register("reason")}
                  />
                </Field>
                <Field
                  error={errors.effectiveDate?.message}
                  label="Last working day"
                >
                  <Input type="date" {...register("effectiveDate")} />
                </Field>
              </div>
              <Field error={errors.notes?.message} label="Notes">
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional context for approvers and Admin finalization"
                  {...register("notes")}
                />
              </Field>
              <ReviewBlock
                branchName={branch.vendor.vendorName}
                picker={selectedPicker}
                type={type}
              />
              {submitError ? <ErrorState message={submitError} /> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/champ/branches/${branch.vendor.id}`}
                  prefetch
                >
                  Cancel
                </Link>
                <Button
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Submitting..." : `Submit ${title}`}
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState message="No active Pickers are available in this Branch." />
          )}
        </section>
      </section>
    </div>
  );
}

function ContextCard({ branch }: { branch: ChampBranchDetail }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <Badge variant="muted">Selected Branch</Badge>
      <h2 className="mt-3 text-base font-semibold">{branch.vendor.vendorName}</h2>
      <div className="mt-4 grid gap-3">
        <Definition label="Branch code" value={branch.vendor.vendorCode} />
        <Definition label="Chain" value={branch.chain.chainName} />
        <Definition
          label="Location"
          value={[branch.vendor.area, branch.vendor.city].filter(Boolean).join(", ") || "Not set"}
        />
        <Definition label="Area Manager" value={branch.areaManager?.nameEn ?? "Not assigned"} />
        <Definition label="Active Pickers" value={branch.activePickerCount} />
      </div>
    </section>
  );
}

function ReviewBlock({
  branchName,
  picker,
  type
}: {
  branchName: string;
  picker: UserSummary | null;
  type: OffboardingType;
}) {
  return (
    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium">Review before submitting</p>
      <p className="mt-1 leading-6 text-muted-foreground">
        {formatEnum(type)} will be reviewed by the Area Manager for {branchName}.
        Admin finalization is irreversible operational offboarding: the Picker
        account is archived and the active Branch assignment is closed.
      </p>
      <p className="mt-2 text-muted-foreground">
        Selected Picker: {picker ? `${picker.nameEn} (${picker.phoneNumber})` : "None"}
      </p>
    </section>
  );
}

function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
