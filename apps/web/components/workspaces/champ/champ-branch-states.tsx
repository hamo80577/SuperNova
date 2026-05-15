"use client";

import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

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
  state
}: {
  label: string;
  state: AsyncState<T>;
}) {
  if (state.status === "loading") {
    return <LoadingCard label={label} />;
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {state.error}
    </div>
  );
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
      {label}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
