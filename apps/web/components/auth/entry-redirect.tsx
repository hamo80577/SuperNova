"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FullPageStatus } from "@/components/auth/protected-route";
import { redirectForUser, useAuth } from "@/components/auth/auth-provider";
import { replaceRoute } from "@/lib/navigation";

export function EntryRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    replaceRoute(router, user ? redirectForUser(user) : "/login");
  }, [loading, router, user]);

  return <FullPageStatus label="Opening SuperNova" />;
}
