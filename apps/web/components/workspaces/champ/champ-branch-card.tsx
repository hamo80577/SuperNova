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
          "group block h-full rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#FFD8BD] hover:bg-[#FFE8D9]/20 hover:shadow-[0_8px_28px_rgba(65,21,23,0.1)] focus-visible:ring-2 focus-visible:ring-[#FFD8BD] motion-reduce:transform-none motion-reduce:transition-none sm:p-5",
          isNavigating &&
            "scale-[1.015] border-[#FFD8BD] bg-[#FFE8D9]/40 shadow-[0_12px_36px_rgba(65,21,23,0.12)]"
        )}
        href={href}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        prefetch
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-6 text-[color:var(--sn-ink)] sm:text-lg">
              {branch.vendor.vendorName}
            </p>
            <p className="mt-1 text-sm font-medium text-[color:var(--sn-muted)]">
              {branch.chain.chainName}
            </p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFE8D9] text-[color:var(--tlb-orange)] transition group-hover:translate-x-0.5 group-hover:bg-[#FFD8BD]">
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
    <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-3 transition-colors group-hover:border-[#FFD8BD] group-hover:bg-white">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-lg font-[family-name:var(--font-data)] font-semibold tabular-nums text-[color:var(--sn-ink)]">
        {value}
      </p>
      <p className="text-xs text-[color:var(--sn-muted)]">{label}</p>
    </div>
  );
}
