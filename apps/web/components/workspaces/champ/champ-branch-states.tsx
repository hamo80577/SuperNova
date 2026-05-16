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
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/90 p-5 text-center">
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-orange-50 text-orange-600">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="max-w-sm text-sm leading-6 text-slate-500">{message}</p>
      </div>
    );
  }

  return (
    <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
