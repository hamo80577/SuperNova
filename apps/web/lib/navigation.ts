import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { showGlobalLoading } from "./navigation-loading";

type ReplaceTarget = Parameters<AppRouterInstance["replace"]>[0];
type PushTarget = Parameters<AppRouterInstance["push"]>[0];

export function replaceRoute(router: AppRouterInstance, href: string) {
  showGlobalLoading("Loading page", { delayMs: 40 });
  router.replace(href as ReplaceTarget);
}

export function pushRoute(router: AppRouterInstance, href: string) {
  showGlobalLoading("Loading page", { delayMs: 40 });
  router.push(href as PushTarget);
}
