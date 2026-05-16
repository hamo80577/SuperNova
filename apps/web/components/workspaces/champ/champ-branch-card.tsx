"use client";

import {
  ArrowRight,
  ShieldAlert,
  type LucideIcon,
  Users
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState
} from "react";

import type { ChampBranch } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";

const NAVIGATION_ANIMATION_MS = 180;

export function BranchCard({ branch }: { branch: ChampBranch }) {
  const router = useRouter();
  const href = `/champ/branches/${branch.vendor.id}`;
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    },
    []
  );

  function animateThenNavigate() {
    if (isNavigating) {
      return;
    }

    const shouldReduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldReduceMotion) {
      router.push(href);
      return;
    }

    setIsNavigating(true);
    navigationTimeoutRef.current = setTimeout(() => {
      router.push(href);
    }, NAVIGATION_ANIMATION_MS);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    animateThenNavigate();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== " ") {
      return;
    }

    event.preventDefault();
    animateThenNavigate();
  }

  return (
    <article className="h-full">
      <Link
        aria-label={`Open ${branch.vendor.vendorName} Branch workspace`}
        className={cn(
          "group block h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/20 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-orange-200 motion-reduce:transform-none motion-reduce:transition-none sm:p-5",
          isNavigating &&
            "scale-[1.015] border-orange-300 bg-orange-50/40 shadow-[0_20px_50px_rgba(15,23,42,0.1)]"
        )}
        href={href}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        prefetch
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-6 text-slate-950 sm:text-lg">
              {branch.vendor.vendorName}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {branch.chain.chainName}
            </p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600 transition group-hover:translate-x-0.5 group-hover:bg-orange-100">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <MiniMetric icon={Users} label="Pickers" value={branch.activePickerCount} />
          <MiniMetric
            icon={ShieldAlert}
            label="Pending"
            value={branch.pendingRequestCount}
          />
        </div>
      </Link>
    </article>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 transition-colors group-hover:border-orange-100 group-hover:bg-white">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-50 text-orange-600">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-950">
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
