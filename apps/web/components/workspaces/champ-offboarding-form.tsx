"use client";

import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RequestDiscardDialog } from "@/components/requests/forms/request-discard-dialog";
import { ResignationRequestForm } from "@/components/requests/request-components";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import type { RequestSummary } from "@/lib/api/requests";
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

export function ChampOffboardingForm({
  initialPickerId,
  mode = "page",
  onCancel,
  onCreated,
  onDirtyChange,
  type,
  vendorId
}: {
  initialPickerId?: string | null;
  mode?: "modal" | "page";
  onCancel?: () => void;
  onCreated?: (request: RequestSummary) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  type: OffboardingType;
  vendorId?: string;
}) {
  const params = useParams<{ vendorId?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeVendorId = vendorId ?? params.vendorId;
  const preselectedPickerId = initialPickerId ?? searchParams.get("pickerId");
  const [formDirty, setFormDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
  });

  useEffect(() => {
    let mounted = true;
    async function loadBranch() {
      if (!activeVendorId) {
        setBranchState({
          status: "error",
          error: "No source Branch is selected for this request."
        });
        return;
      }

      try {
        const branch = await workspacesApi.champBranchDetail(activeVendorId);
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
  }, [activeVendorId]);

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
  const branchHref = `/champ/branches/${branch.vendor.id}`;

  function handleDirtyChange(isDirty: boolean) {
    setFormDirty(isDirty);
    onDirtyChange?.(isDirty);
  }

  function requestPageCancel() {
    if (formDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    router.push(branchHref);
  }

  const formContent = (
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="mb-5 rounded-2xl border border-[#FFD8BD] bg-[#FFE8D9] p-4 text-sm text-[color:var(--tlb-orange-900)]">
        <p className="font-semibold">{branch.vendor.vendorName}</p>
        <p className="mt-1 text-[color:var(--tlb-orange-900)]">
          {branch.vendor.vendorCode} · {branch.chain.chainName}
        </p>
      </div>
      <ResignationRequestForm
        fixedSourceVendorId={branch.vendor.id}
        initialPicker={preselectedPicker}
        onCancel={mode === "modal" ? onCancel : requestPageCancel}
        onCreated={(request) => onCreated?.(request)}
        onDirtyChange={handleDirtyChange}
      />
    </section>
  );

  if (mode === "modal") {
    return formContent;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <Link
          className="mb-4 inline-flex items-center text-sm font-medium text-[color:var(--tlb-orange)]"
          href={branchHref}
          prefetch
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Branch workspace
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]" variant="outline">
              Branch-scoped {formatEnum(type)}
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--sn-ink)]">
              Submit {formatEnum(type)}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sn-muted)]">
              Picker search is locked to this Branch. Chain and Branch are
              written to the request from the active assignment selected by the
              backend.
            </p>
          </div>
          <ShieldAlert className="h-7 w-7 text-[color:var(--tlb-orange)]" />
        </div>
      </section>
      {formContent}
      <RequestDiscardDialog
        onConfirm={() => router.push(branchHref)}
        onKeepEditing={() => setConfirmCloseOpen(false)}
        open={confirmCloseOpen}
      />
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return <DetailPanelSkeleton label={label} />;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[oklch(0.85_0.08_27)] bg-[oklch(0.95_0.035_27)] p-5 text-sm text-[oklch(0.55_0.19_27)]">
      <AlertCircle className="h-4 w-4" />
      {message}
      <Link
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "ml-auto bg-white border-[color:var(--sn-border)]")}
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
