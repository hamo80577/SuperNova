import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type ReplaceTarget = Parameters<AppRouterInstance["replace"]>[0];

export function replaceRoute(router: AppRouterInstance, href: string) {
  router.replace(href as ReplaceTarget);
}
