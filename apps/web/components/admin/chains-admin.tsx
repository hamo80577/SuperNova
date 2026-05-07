"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
  type ReactNode
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  EmptyState,
  ErrorState,
  LoadingRows
} from "@/components/admin/resource-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Chain,
  type ChainStatus,
  organizationApi,
  type PageMeta
} from "@/lib/api/organization";

const chainSchema = z.object({
  chainName: z.string().trim().min(2, "Chain name is required.").max(120),
  chainCode: z.string().trim().min(2, "Chain code is required.").max(32),
  status: z.enum(["ACTIVE", "INACTIVE"])
});

type ChainFormValues = z.infer<typeof chainSchema>;

const DEFAULT_META: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
};

export function ChainsAdmin() {
  const [items, setItems] = useState<Chain[]>([]);
  const [meta, setMeta] = useState<PageMeta>(DEFAULT_META);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<ChainStatus | "">("");
  const [editing, setEditing] = useState<Chain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ChainFormValues>({
    resolver: zodResolver(chainSchema),
    defaultValues: {
      chainName: "",
      chainCode: "",
      status: "ACTIVE"
    }
  });

  async function loadChains() {
    setLoading(true);
    setError(null);

    try {
      const response = await organizationApi.listChains({
        page,
        pageSize: 10,
        q: deferredQuery,
        status
      });
      setItems(response.items);
      setMeta(response.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load chains."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChains();
  }, [deferredQuery, page, status]);

  function beginEdit(chain: Chain) {
    setEditing(chain);
    form.reset({
      chainName: chain.chainName,
      chainCode: chain.chainCode,
      status: chain.status
    });
  }

  function resetForm() {
    setEditing(null);
    form.reset({
      chainName: "",
      chainCode: "",
      status: "ACTIVE"
    });
  }

  function onSubmit(values: ChainFormValues) {
    startTransition(async () => {
      setError(null);
      const payload = {
        ...values,
        chainCode: values.chainCode.toUpperCase()
      };

      try {
        if (editing) {
          await organizationApi.updateChain(editing.id, payload);
        } else {
          await organizationApi.createChain(payload);
        }
        resetForm();
        await loadChains();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to save chain."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Chains</h1>
          <p className="text-sm text-muted-foreground">
            Create and maintain partner chain records.
          </p>
        </div>
        {error ? <ErrorState message={error} /> : null}
        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FieldError error={form.formState.errors.chainName?.message}>
            <Input placeholder="Chain name" {...form.register("chainName")} />
          </FieldError>
          <FieldError error={form.formState.errors.chainCode?.message}>
            <Input
              placeholder="Code"
              {...form.register("chainCode")}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                form.register("chainCode").onChange(event);
              }}
            />
          </FieldError>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            {...form.register("status")}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <div className="flex gap-2">
            <Button disabled={isPending} type="submit">
              {editing ? "Update" : "Create"}
            </Button>
            {editing ? (
              <Button onClick={resetForm} type="button" variant="outline">
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <Input
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Search chain name or code"
            value={query}
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ChainStatus | "");
            }}
            value={status}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        {loading ? (
          <LoadingRows label="Loading chains" />
        ) : items.length === 0 ? (
          <EmptyState
            description="Create a chain before adding vendor branches."
            title="No chains found"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Updated</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((chain) => (
                  <tr className="border-b last:border-0" key={chain.id}>
                    <td className="py-3 pr-4 font-medium">{chain.chainName}</td>
                    <td className="py-3 pr-4">{chain.chainCode}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={chain.status} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(chain.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        onClick={() => beginEdit(chain)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} page={page} setPage={setPage} />
      </section>
    </div>
  );
}

function FieldError({
  children,
  error
}: {
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Pagination({
  meta,
  page,
  setPage
}: {
  meta: PageMeta;
  page: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={page >= meta.totalPages}
          onClick={() => setPage(page + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
