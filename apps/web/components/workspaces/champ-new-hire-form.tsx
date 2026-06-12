"use client";

import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NewHireRequestModal } from "@/components/requests/request-components";
import { Badge } from "@/components/ui/badge";
import { DetailPanelSkeleton } from "@/components/ui/skeleton";
import {
  type ChampBranchDetail,
  workspacesApi
} from "@/lib/api/workspaces";

type AsyncState<T> =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: T; error?: never };

export function ChampNewHireForm() {
  const params = useParams<{ vendorId: string }>();
  const router = useRouter();
  const [branchState, setBranchState] = useState<AsyncState<ChampBranchDetail>>({
    status: "loading"
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

  if (branchState.status === "loading") {
    return <DetailPanelSkeleton label="Loading selected Branch context" />;
  }

  if (branchState.status === "error") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {branchState.error}
      </div>
    );
  }

  const branch = branchState.data;
  const branchHref = `/champ/branches/${branch.vendor.id}`;

  return (
    <div className="grid gap-5">
      <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-5 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
        <Link
          className="mb-4 inline-flex items-center text-sm font-medium text-primary"
          href={branchHref}
          prefetch
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Branch workspace
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge
              className="border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
              variant="outline"
            >
              Branch-first New Hire
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              New Hire request
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              New Hire now opens as the same workflow modal used across
              SuperNova workspaces.
            </p>
          </div>
          <UserPlus className="h-7 w-7 text-primary" />
        </div>
      </section>

      <NewHireRequestModal
        description="Create a Branch-scoped New Hire request without leaving the Branch workflow."
        fixedSourceVendorId={branch.vendor.id}
        initialTargetRole="PICKER"
        lockedBranchContext={branch}
        lockTargetRole
        onClose={() => router.push(branchHref)}
        onCreated={(request) => {
          router.push(`/tickets?requestId=${request.id}`);
        }}
        title="Picker New Hire request"
      />
    </div>
  );
}
