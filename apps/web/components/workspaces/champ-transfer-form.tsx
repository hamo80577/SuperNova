"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2, MoveRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { organizationApi, type Vendor } from "@/lib/api/organization";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import {
  type ChampBranchDetail,
  type UserSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const transferSchema = z.object({
  targetUserId: z.string().uuid("Select an active Picker from this Branch."),
  destinationVendorId: z.string().uuid("Select a destination Branch."),
  reason: z.string().trim().min(3, "Transfer reason is required.").max(1000),
  requestedTransferDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional()
});

type TransferFormValues = z.infer<typeof transferSchema>;

export function ChampTransferForm() {
  const params = useParams<{ vendorId: string }>();
  const [state, setState] = useState<
    AsyncState<{ branch: ChampBranchDetail; vendors: Vendor[] }>
  >({ status: "loading" });
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema)
  });

  useEffect(() => {
    let mounted = true;

    async function loadTransferContext() {
      try {
        const [branch, vendorsResponse] = await Promise.all([
          workspacesApi.champBranchDetail(params.vendorId),
          organizationApi.listVendors({ status: "ACTIVE", pageSize: 100 })
        ]);

        if (mounted) {
          setState({
            status: "ready",
            data: {
              branch,
              vendors: vendorsResponse.items.filter(
                (vendor) => vendor.id !== params.vendorId
              )
            }
          });
        }
      } catch (caughtError) {
        if (mounted) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Transfer context."
          });
        }
      }
    }

    void loadTransferContext();

    return () => {
      mounted = false;
    };
  }, [params.vendorId]);

  const selectedPickerId = watch("targetUserId");
  const selectedDestinationId = watch("destinationVendorId");

  const selectedPicker = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return (
      state.data.branch.pickers.find((item) => item.picker.id === selectedPickerId)
        ?.picker ?? null
    );
  }, [state, selectedPickerId]);

  const selectedDestination = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return (
      state.data.vendors.find((vendor) => vendor.id === selectedDestinationId) ??
      null
    );
  }, [state, selectedDestinationId]);

  function onSubmit(values: TransferFormValues) {
    startTransition(async () => {
      setSubmitError(null);
      try {
        const created = await requestsApi.createTransfer({
          sourceVendorId: params.vendorId,
          targetUserId: values.targetUserId,
          destinationVendorId: values.destinationVendorId,
          reason: values.reason,
          ...(values.requestedTransferDate
            ? { requestedTransferDate: values.requestedTransferDate }
            : {}),
          ...(values.notes ? { notes: values.notes } : {})
        });
        setCreatedRequest(created);
      } catch (caughtError) {
        setSubmitError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit Transfer request."
        );
      }
    });
  }

  if (state.status === "loading") {
    return <LoadingState label="Loading selected Branch and destination Branches" />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.error} />;
  }

  const { branch, vendors } = state.data;
  const approvalPath =
    selectedDestination && selectedDestination.chainId !== branch.chain.id
      ? "Cross-chain: source Area Manager, then destination Area Manager"
      : selectedDestination
        ? "Same-chain: source Area Manager approval only"
        : "Select a destination Branch to preview the approval path";

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
            <Badge variant="outline">Branch-first Transfer</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Transfer Picker
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              This request starts from the selected source Branch. The backend
              derives source Chain scope and applies the assignment move only
              after the required Area Manager approvals.
            </p>
          </div>
          <MoveRight className="h-7 w-7 text-primary" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ContextCard branch={branch} />
        <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold">Transfer request details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one active Picker from this Branch and one active destination
            Branch. This is not a direct assignment edit.
          </p>

          {createdRequest ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium">Transfer request submitted.</p>
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
                    href={`/requests/${createdRequest.id}`}
                    prefetch
                  >
                    Open request detail
                  </Link>
                </div>
              </div>
            </div>
          ) : branch.pickers.length && vendors.length ? (
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
              <Field
                error={errors.destinationVendorId?.message}
                label="Destination Branch"
              >
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  {...register("destinationVendorId")}
                >
                  <option value="">Select destination Branch</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName} · {vendor.chain.chainName}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.reason?.message} label="Reason">
                  <Input
                    placeholder="Example: Picker moved to another operating Branch"
                    {...register("reason")}
                  />
                </Field>
                <Field
                  error={errors.requestedTransferDate?.message}
                  label="Requested transfer date"
                >
                  <Input type="date" {...register("requestedTransferDate")} />
                </Field>
              </div>
              <Field error={errors.notes?.message} label="Notes">
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional context for source and destination Area Managers"
                  {...register("notes")}
                />
              </Field>
              <ReviewBlock
                approvalPath={approvalPath}
                branchName={branch.vendor.vendorName}
                destination={selectedDestination}
                picker={selectedPicker}
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
                <Button disabled={isPending} type="submit">
                  {isPending ? "Submitting..." : "Submit Transfer"}
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState
              message={
                !branch.pickers.length
                  ? "No active Pickers are available in this source Branch."
                  : "No active destination Branches are available."
              }
            />
          )}
        </section>
      </section>
    </div>
  );
}

function ContextCard({ branch }: { branch: ChampBranchDetail }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <Badge variant="muted">Source Branch</Badge>
      <h2 className="mt-3 text-base font-semibold">{branch.vendor.vendorName}</h2>
      <div className="mt-4 grid gap-3">
        <Definition label="Branch code" value={branch.vendor.vendorCode} />
        <Definition label="Source Chain" value={branch.chain.chainName} />
        <Definition
          label="Location"
          value={
            [branch.vendor.area, branch.vendor.city].filter(Boolean).join(", ") ||
            "Not set"
          }
        />
        <Definition label="Source Area Manager" value={branch.areaManager?.nameEn ?? "Not assigned"} />
        <Definition label="Active Pickers" value={branch.activePickerCount} />
      </div>
    </section>
  );
}

function ReviewBlock({
  approvalPath,
  branchName,
  destination,
  picker
}: {
  approvalPath: string;
  branchName: string;
  destination: Vendor | null;
  picker: UserSummary | null;
}) {
  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-medium">Review before submitting</p>
      <p className="mt-1 leading-6 text-muted-foreground">
        The old assignment remains as history. SuperNova closes it and creates
        the new active assignment only after the approval path completes.
      </p>
      <div className="mt-3 grid gap-2">
        <Definition label="Picker" value={picker ? `${picker.nameEn} (${picker.phoneNumber})` : "None"} />
        <Definition label="Source Branch" value={branchName} />
        <Definition
          label="Destination Branch"
          value={
            destination
              ? `${destination.vendorName} (${destination.chain.chainName})`
              : "None"
          }
        />
        <Definition label="Approval path" value={approvalPath} />
      </div>
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
