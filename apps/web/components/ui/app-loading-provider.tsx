"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";

import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import {
  getGlobalLoadingSnapshot,
  hideGlobalLoading,
  showGlobalLoading,
  subscribeGlobalLoading
} from "@/lib/navigation-loading";

const FAILSAFE_TIMEOUT_MS = 12_000;
const MIN_VISIBLE_MS = 280;

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(getGlobalLoadingSnapshot);
  const [progressActive, setProgressActive] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const previousPathnameRef = useRef(pathname);
  const showTimerRef = useRef<number | null>(null);

  useEffect(
    () =>
      subscribeGlobalLoading((snapshot) => {
        setLoading(snapshot);
      }),
    []
  );

  useEffect(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (!loading.active) {
      setProgressActive(false);
      return;
    }

    showTimerRef.current = window.setTimeout(() => {
      setShownAt(Date.now());
      setProgressActive(true);
      showTimerRef.current = null;
    }, loading.delayMs);
  }, [loading.active, loading.delayMs]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (!loading.active || previousPathname === pathname) {
      return;
    }

    const elapsed = Date.now() - shownAt;
    const timeout = window.setTimeout(
      hideGlobalLoading,
      Math.max(0, MIN_VISIBLE_MS - elapsed)
    );

    return () => window.clearTimeout(timeout);
  }, [pathname, loading.active, shownAt]);

  useEffect(() => {
    if (!loading.active) {
      return;
    }

    const timeout = window.setTimeout(hideGlobalLoading, FAILSAFE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [loading.active]);

  useEffect(
    () => () => {
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
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

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target ||
        anchor.download ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }

      const nextPath = `${anchor.pathname}${anchor.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const hashOnlyChange =
        nextPath === currentPath && anchor.hash !== window.location.hash;

      if (nextPath !== currentPath && !hashOnlyChange) {
        showGlobalLoading("Loading page", { delayMs: 40 });
      }
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  return (
    <>
      {children}
      <RouteProgressBar active={progressActive} />
    </>
  );
}

export function useStartAppLoading() {
  return (label?: string) => showGlobalLoading(label);
}

export function startLoadingFromClick(
  event: ReactMouseEvent,
  label = "Loading"
) {
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

  showGlobalLoading(label);
}
