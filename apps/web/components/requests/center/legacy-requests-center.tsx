"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestsApi, type CreateRequestPayload, type RequestStatus, type RequestSummary, type RequestType } from "@/lib/api/requests";
import { pushRoute } from "@/lib/navigation";
import { internalRequestEngineTypes, requestStatuses, requestTypes } from "../shared/request-constants";
import { EmptyState } from "../shared/request-empty-state";
import { Field } from "../shared/request-field";
import { ErrorState, LoadingState } from "../shared/request-states";
import { formatEnum } from "../shared/request-utils";
import { RequestsTable } from "./requests-table";

export function LegacyRequestsCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const canUseInternalRequestEngine =
    (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") &&
    internalRequestEngineTypes.length > 0;
  const [items, setItems] = useState<RequestSummary[]>([]);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [type, setType] = useState<RequestType | "">("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    type: "TRANSFER" as RequestType,
    sourceChainId: "",
    sourceVendorId: "",
    destinationChainId: "",
    destinationVendorId: "",
    targetUserId: "",
    details: ""
  });

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const response = await requestsApi.list({
        status,
        type,
        q: query,
        pageSize: 20
      });
      setItems(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, [status, type]);

  function createRequest() {
    startTransition(async () => {
      setError(null);
      const payload: CreateRequestPayload = {
        type: form.type,
        sourceChainId: form.sourceChainId || undefined,
        sourceVendorId: form.sourceVendorId || undefined,
        destinationChainId: form.destinationChainId || undefined,
        destinationVendorId: form.destinationVendorId || undefined,
        targetUserId: form.targetUserId || undefined,
        payload: form.details ? { details: form.details } : undefined
      };

      try {
        const created = await requestsApi.create(payload);
        pushRoute(router, `/tickets?requestId=${created.id}`);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to create request."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">Phase 5 engine</Badge>
            <h1 className="mt-3 text-xl font-semibold">Requests</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Lifecycle request records and approval state. Branch-first New Hire,
              Offboarding, and Transfer workflows apply system changes through
              backend-controlled finalization paths.
            </p>
          </div>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href="/tickets"
          >
            Pending approvals
          </Link>
        </div>
      </section>

      {canUseInternalRequestEngine ? (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <Badge variant="muted">Admin only</Badge>
          <h2 className="mt-3 text-base font-semibold">
            Internal request engine testing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal request engine testing for generic request records. New
            Hire, Offboarding, and Transfer must use Branch-first workflows.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Type">
              <select
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as RequestType
                  }))
                }
                value={form.type}
              >
                {internalRequestEngineTypes.map((value) => (
                  <option key={value} value={value}>
                    {formatEnum(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source Chain ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceChainId: event.target.value
                  }))
                }
                value={form.sourceChainId}
              />
            </Field>
            <Field label="Source Vendor ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceVendorId: event.target.value
                  }))
                }
                value={form.sourceVendorId}
              />
            </Field>
            <Field label="Target User ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetUserId: event.target.value
                  }))
                }
                value={form.targetUserId}
              />
            </Field>
            <Field label="Destination Chain ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    destinationChainId: event.target.value
                  }))
                }
                value={form.destinationChainId}
              />
            </Field>
            <Field label="Destination Vendor ID">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    destinationVendorId: event.target.value
                  }))
                }
                value={form.destinationVendorId}
              />
            </Field>
            <Field label="Details">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    details: event.target.value
                  }))
                }
                value={form.details}
              />
            </Field>
            <div className="flex items-end">
              <Button disabled={isPending} onClick={createRequest} type="button">
                Create Draft
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search request context"
            value={query}
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as RequestStatus | "")}
            value={status}
          >
            <option value="">All statuses</option>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setType(event.target.value as RequestType | "")}
            value={type}
          >
            <option value="">All types</option>
            {requestTypes.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
          <Button onClick={() => void loadRequests()} type="button" variant="outline">
            Search
          </Button>
        </div>
        {error ? <ErrorState message={error} /> : null}
        {loading ? (
          <LoadingState label="Loading requests" />
        ) : items.length ? (
          <RequestsTable items={items} />
        ) : (
          <EmptyState message="No requests match the current filters." />
        )}
      </section>
    </div>
  );
}
