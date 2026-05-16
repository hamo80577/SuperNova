"use client";

import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ResignationRequestForm } from "@/components/requests/request-components";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import {
  type ChampBranchDetail,
  workspacesApi
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

type OffboardingType = "RESIGNATION";
type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function ChampOffboardingForm({ type }: { type: OffboardingType }) {
  const params = useParams<{ vendorId: string }>();
  const [preselectedPickerId, setPreselectedPickerId] = useState<string | null>(
    null
  );
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
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
        if (mounted) setBranchState({ status: "ready", data: branch });
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

  const preselectedPicker = useMemo(() => {
    if (branchState.status !== "ready" || !preselectedPickerId) return null;
    return (
      branchState.data.pickers.find(
        (item) => item.picker.id === preselectedPickerId
      )?.picker ?? null
    );
  }, [branchState, preselectedPickerId]);

  if (branchState.status === "loading") {
    return <LoadingState label="Loading selected Branch context" />;
  }

  if (branchState.status === "error") {
    return <ErrorState message={branchState.error} />;
  }

  const branch = branchState.data;

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link
          className="mb-4 inline-flex items-center text-sm font-medium text-orange-700"
          href={`/champ/branches/${branch.vendor.id}`}
          prefetch
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Branch workspace
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Branch-scoped {formatEnum(type)}
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Submit {formatEnum(type)}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Picker search is locked to this Branch. Chain and Branch are
              written to the request from the active assignment selected by the
              backend.
            </p>
          </div>
          <ShieldAlert className="h-7 w-7 text-orange-600" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
          <p className="font-semibold">{branch.vendor.vendorName}</p>
          <p className="mt-1 text-orange-800">
            {branch.vendor.vendorCode} · {branch.chain.chainName}
          </p>
        </div>
        <ResignationRequestForm
          fixedSourceVendorId={branch.vendor.id}
          initialPicker={preselectedPicker}
          onCreated={() => undefined}
        />
      </section>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <DetailPanelSkeleton label={label} />;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <AlertCircle className="h-4 w-4" />
      {message}
      <Link
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "ml-auto bg-white")}
        href="/champ/branches"
        prefetch
      >
        Back
      </Link>
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
