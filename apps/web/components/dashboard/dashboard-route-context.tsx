"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const DashboardRouteShellContext = createContext(false);

export function DashboardRouteShellProvider({
  children
}: {
  children: ReactNode;
}) {
  return (
    <DashboardRouteShellContext.Provider value>
      {children}
    </DashboardRouteShellContext.Provider>
  );
}

export function useDashboardRouteShell() {
  return useContext(DashboardRouteShellContext);
}
