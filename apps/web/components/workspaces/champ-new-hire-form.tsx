"use client";

import { ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { NewHireRequestForm } from "@/components/requests/request-components";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  type ChampBranchDetail,
  workspacesApi
} from "@/lib/api/workspaces";
import type { RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function ChampNewHireForm() {
  const params = useParams<{ vendorId: string }>();
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
  });
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);

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

  if (branchState.status === "loading") {
    return <LoadingState label="Loading selected Branch context" />;
  }

  if (branchState.status === "error") {
    return <ErrorState message={branchState.error} />;
  }

  const branch = branchState.data;

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.04)]">
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
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Branch-first New Hire
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Submit New Hire
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Same New Hire and Rehire workflow used by Admin. Previous Pickers
              are detected by phone number or National ID before request submission.
            </p>
          </div>
          <UserPlus className="h-7 w-7 text-primary" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ContextCard branch={branch} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.04)] lg:col-span-2">
          <h2 className="text-base font-semibold">Candidate information</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This does not create a Picker directly. It submits the request for
            Area Manager approval and Admin finalization.
          </p>

          {createdRequest ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
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
                    href={`/tickets?requestId=${createdRequest.id}`}
                    prefetch
                  >
                    Open request
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <NewHireRequestForm
                fixedSourceVendorId={branch.vendor.id}
                onCreated={setCreatedRequest}
              />
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function ContextCard({ branch }: { branch: ChampBranchDetail }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.04)]">
      <Badge variant="muted">Selected Branch</Badge>
      <h2 className="mt-3 text-base font-semibold">{branch.vendor.vendorName}</h2>
      <div className="mt-4 grid gap-3">
        <Definition label="Branch code" value={branch.vendor.vendorCode} />
        <Definition label="Chain" value={branch.chain.chainName} />
        <Definition label="Area Manager" value={branch.areaManager?.nameEn ?? "Not assigned"} />
      </div>
    </section>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-sm">
      {label}
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
