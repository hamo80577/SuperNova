"use client";

import { AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  notificationsApi,
  type NotificationItem
} from "@/lib/api/notifications";

export function NotificationsCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.list({ pageSize: 30 });
      setItems(response.items);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  function markRead(id: string) {
    startTransition(async () => {
      try {
        await notificationsApi.markRead(id);
        await loadNotifications();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to mark notification read."
        );
      }
    });
  }

  function markAllRead() {
    startTransition(async () => {
      try {
        await notificationsApi.markAllRead();
        await loadNotifications();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to mark notifications read."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="outline">In-app notifications</Badge>
            <h1 className="mt-3 text-xl font-semibold">Notifications</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Workflow updates and credential handoff messages. Temporary New
              Hire credentials are delivered only to the Champ notification after
              Admin finalization.
            </p>
          </div>
          <Button
            disabled={isPending || !items.some((item) => !item.readAt)}
            onClick={markAllRead}
            type="button"
            variant="outline"
          >
            Mark all read
          </Button>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingState />
      ) : items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <section
              className="rounded-lg border bg-card p-5 shadow-sm"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.readAt ? "muted" : "default"}>
                      {item.readAt ? "Read" : "Unread"}
                    </Badge>
                    <Badge variant="outline">{formatEnum(item.type)}</Badge>
                  </div>
                  <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {extractRequestId(item.payload) ? (
                    <Link
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
                      href={`/requests/${extractRequestId(item.payload)}`}
                      prefetch
                    >
                      Open request
                    </Link>
                  ) : null}
                  {!item.readAt ? (
                    <Button
                      disabled={isPending}
                      onClick={() => markRead(item.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function extractRequestId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const requestId = (payload as Record<string, unknown>).requestId;
  return typeof requestId === "string" ? requestId : null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
      Loading notifications
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-lg border bg-card p-8 text-center shadow-sm">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No notifications yet.</p>
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
