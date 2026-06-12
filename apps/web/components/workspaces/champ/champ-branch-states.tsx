"use client";

import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BranchCardSkeleton,
  DetailPanelSkeleton
} from "@/components/ui/skeleton";
import type { AsyncState } from "./champ-branch-types";

export function useAsyncData<T>(loader: () => Promise<T>, reloadVersion = 0) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await loader();
        if (mounted) {
          setState({ status: "ready", data });
        }
      } catch (caughtError) {
        if (mounted) {
          setState({
            status: "error",
            error:
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load Branch workspace."
          });
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [loader, reloadVersion]);

  return state;
}

export function WorkspaceState<T>({
  label,
  quiet = false,
  state
}: {
  label: string;
  quiet?: boolean;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return <LoadingCard label={label} quiet={quiet} />;
  }

  return (
    <div className="rounded-2xl border border-[oklch(0.85_0.08_27)] bg-[oklch(0.95_0.035_27)] p-4 text-sm text-[oklch(0.55_0.19_27)]">
      {state.error}
    </div>
  );
}

export function LoadingCard({
  label,
  quiet = false
}: {
  label: string;
  quiet?: boolean;
}) {
  if (quiet) {
    return (
      <div
        aria-busy="true"
        aria-label={label}
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        role="status"
      >
        <BranchCardSkeleton />
        <BranchCardSkeleton />
        <BranchCardSkeleton />
      </div>
    );
  }

  return <DetailPanelSkeleton label={label} />;
}

export function EmptyState({
  compact = false,
  message
}: {
  compact?: boolean;
  message: string;
}) {
  if (compact) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[color:var(--sn-border)] bg-white/90 p-5 text-center">
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="max-w-sm text-sm leading-6 text-[color:var(--sn-muted)]">{message}</p>
      </div>
    );
  }

  return (
    <div className="grid place-items-center rounded-2xl border border-[color:var(--sn-border)] bg-white p-8 text-center shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)]">
      <Inbox className="mb-3 h-8 w-8 text-[color:var(--sn-faint)]" />
      <p className="text-sm text-[color:var(--sn-muted)]">{message}</p>
    </div>
  );
}
