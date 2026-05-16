"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const FINISH_DELAY_MS = 220;
const TICK_MS = 240;

export function RouteProgressBar({ active }: { active: boolean }) {
  const [rendered, setRendered] = useState(false);
  const [progress, setProgress] = useState(0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (active) {
      setRendered(true);
      setProgress((current) => (current > 0 && current < 100 ? current : 18));
      return;
    }

    if (!rendered) {
      return;
    }

    setProgress(100);
    hideTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      setProgress(0);
      hideTimerRef.current = null;
    }, FINISH_DELAY_MS);
  }, [active, rendered]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) {
          return current;
        }

        const remaining = 88 - current;
        return current + Math.max(2, remaining * 0.24);
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  if (!rendered) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px] overflow-hidden bg-transparent"
    >
      <div
        className={cn(
          "h-full rounded-r-full bg-primary shadow-[0_0_18px_hsl(var(--brand-shadow)/0.35)] transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
          active ? "opacity-100" : "opacity-0"
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
