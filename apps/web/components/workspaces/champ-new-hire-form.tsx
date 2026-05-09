"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
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

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

const newHireSchema = z
  .object({
    nameEn: z.string().trim().max(160).optional(),
    nameAr: z.string().trim().max(160).optional(),
    phoneNumber: z.string().trim().min(5, "Phone number is required.").max(40),
    nationalId: z.string().trim().max(40).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional()
  })
  .refine((value) => Boolean(value.nameEn || value.nameAr), {
    message: "Candidate English or Arabic name is required.",
    path: ["nameEn"]
  });

type NewHireFormValues = z.infer<typeof newHireSchema>;

export function ChampNewHireForm() {
  const params = useParams<{ vendorId: string }>();
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
  });
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<NewHireFormValues>({
    resolver: zodResolver(newHireSchema),
    defaultValues: {
      gender: "UNSPECIFIED"
    }
  });

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

  function onSubmit(values: NewHireFormValues) {
    startTransition(async () => {
      setSubmitError(null);
      try {
        const created = await requestsApi.createNewHire({
          sourceVendorId: params.vendorId,
          ...cleanOptional(values)
        });
        setCreatedRequest(created);
      } catch (caughtError) {
        setSubmitError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit New Hire request."
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
            <Badge variant="outline">Branch-first New Hire</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Submit New Hire
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              This request runs inside the selected Branch context. SuperNova
              derives source Vendor and Chain from this Branch; the Champ does
              not enter source IDs manually.
            </p>
          </div>
          <UserPlus className="h-7 w-7 text-primary" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ContextCard branch={branch} />
        <section className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold">Candidate information</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin finalization later requires Shopper ID. This form does not
            create a Picker directly.
          </p>

          {createdRequest ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium">New Hire request submitted.</p>
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
          ) : (
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.nameEn?.message} label="Candidate name (English)">
                  <Input placeholder="Example: Ahmed Hassan" {...register("nameEn")} />
                </Field>
                <Field error={errors.nameAr?.message} label="Candidate name (Arabic)">
                  <Input placeholder="Optional Arabic name" {...register("nameAr")} />
                </Field>
                <Field error={errors.phoneNumber?.message} label="Phone number">
                  <Input placeholder="Candidate login phone" {...register("phoneNumber")} />
                </Field>
                <Field error={errors.nationalId?.message} label="National ID">
                  <Input placeholder="Optional" {...register("nationalId")} />
                </Field>
                <Field error={errors.dateOfBirth?.message} label="Date of birth">
                  <Input type="date" {...register("dateOfBirth")} />
                </Field>
                <Field error={errors.gender?.message} label="Gender">
                  <select
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    {...register("gender")}
                  >
                    <option value="UNSPECIFIED">Unspecified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </Field>
              </div>
              <Field error={errors.address?.message} label="Address">
                <Input placeholder="Optional address" {...register("address")} />
              </Field>
              <Field error={errors.notes?.message} label="Notes">
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional context for approvers"
                  {...register("notes")}
                />
              </Field>
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
                  {isPending ? "Submitting..." : "Submit New Hire"}
                </Button>
              </div>
            </form>
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
        <Definition
          label="Area Manager"
          value={formatUser(branch.areaManager)}
        />
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

function cleanOptional(values: NewHireFormValues) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== "")
  ) as NewHireFormValues;
}

function formatUser(user: UserSummary | null) {
  return user ? user.nameEn : "Not assigned";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
