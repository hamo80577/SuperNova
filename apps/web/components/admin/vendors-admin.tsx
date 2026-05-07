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
  organizationApi,
  type PageMeta,
  type Vendor,
  type VendorStatus
} from "@/lib/api/organization";

const vendorSchema = z.object({
  vendorName: z.string().trim().min(2, "Vendor name is required.").max(160),
  vendorCode: z.string().trim().min(2, "Vendor code is required.").max(32),
  vendorExternalId: z.string().trim().max(64).optional(),
  chainId: z.string().uuid("Chain is required."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  address: z.string().trim().max(240).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional()
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const DEFAULT_META: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
};

export function VendorsAdmin() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [meta, setMeta] = useState<PageMeta>(DEFAULT_META);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<VendorStatus | "">("");
  const [chainId, setChainId] = useState("");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendorName: "",
      vendorCode: "",
      vendorExternalId: "",
      chainId: "",
      status: "ACTIVE",
      address: "",
      area: "",
      city: ""
    }
  });

  async function loadChains() {
    const response = await organizationApi.listChains({
      page: 1,
      pageSize: 100,
      status: "ACTIVE"
    });
    setChains(response.items);
  }

  async function loadVendors() {
    setLoading(true);
    setError(null);

    try {
      const response = await organizationApi.listVendors({
        page,
        pageSize: 10,
        q: deferredQuery,
        status,
        chainId
      });
      setItems(response.items);
      setMeta(response.meta);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load vendors."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChains().catch((caughtError) => {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load chains."
      );
    });
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [chainId, deferredQuery, page, status]);

  function beginEdit(vendor: Vendor) {
    setEditing(vendor);
    form.reset({
      vendorName: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      vendorExternalId: vendor.vendorExternalId ?? "",
      chainId: vendor.chainId,
      status: vendor.status,
      address: vendor.address ?? "",
      area: vendor.area ?? "",
      city: vendor.city ?? ""
    });
  }

  function resetForm() {
    setEditing(null);
    form.reset({
      vendorName: "",
      vendorCode: "",
      vendorExternalId: "",
      chainId: "",
      status: "ACTIVE",
      address: "",
      area: "",
      city: ""
    });
  }

  function onSubmit(values: VendorFormValues) {
    startTransition(async () => {
      setError(null);
      const payload = {
        ...values,
        vendorCode: values.vendorCode.toUpperCase(),
        vendorExternalId: values.vendorExternalId || null,
        address: values.address || null,
        area: values.area || null,
        city: values.city || null
      };

      try {
        if (editing) {
          await organizationApi.updateVendor(editing.id, payload);
        } else {
          await organizationApi.createVendor(payload);
        }
        resetForm();
        await loadVendors();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to save vendor."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Vendors / Branches</h1>
          <p className="text-sm text-muted-foreground">
            Create and maintain branch records under a chain.
          </p>
        </div>
        {error ? <ErrorState message={error} /> : null}
        <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-3 md:grid-cols-3">
            <FieldError error={form.formState.errors.vendorName?.message}>
              <Input placeholder="Vendor / branch name" {...form.register("vendorName")} />
            </FieldError>
            <FieldError error={form.formState.errors.vendorCode?.message}>
              <Input
                placeholder="Code"
                {...form.register("vendorCode")}
                onChange={(event) => {
                  event.target.value = event.target.value.toUpperCase();
                  form.register("vendorCode").onChange(event);
                }}
              />
            </FieldError>
            <FieldError error={form.formState.errors.vendorExternalId?.message}>
              <Input
                placeholder="External ID"
                {...form.register("vendorExternalId")}
              />
            </FieldError>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FieldError error={form.formState.errors.chainId?.message}>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register("chainId")}
              >
                <option value="">Select chain</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.chainName} ({chain.chainCode})
                  </option>
                ))}
              </select>
            </FieldError>
            <select
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("status")}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <Input placeholder="City" {...form.register("city")} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Area" {...form.register("area")} />
            <Input
              className="md:col-span-2"
              placeholder="Address"
              {...form.register("address")}
            />
          </div>
          <div className="flex gap-2">
            <Button disabled={isPending || chains.length === 0} type="submit">
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
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_220px]">
          <Input
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Search vendor, code, external ID, area, or city"
            value={query}
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as VendorStatus | "");
            }}
            value={status}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              setPage(1);
              setChainId(event.target.value);
            }}
            value={chainId}
          >
            <option value="">All chains</option>
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.chainName}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <LoadingRows label="Loading vendors" />
        ) : items.length === 0 ? (
          <EmptyState
            description="Create a branch after at least one active chain exists."
            title="No vendors found"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Chain</th>
                  <th className="py-3 pr-4">Area</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((vendor) => (
                  <tr className="border-b last:border-0" key={vendor.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{vendor.vendorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.vendorExternalId || "No external ID"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{vendor.vendorCode}</td>
                    <td className="py-3 pr-4">{vendor.chain.chainName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {[vendor.area, vendor.city].filter(Boolean).join(", ") ||
                        "Not set"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={vendor.status} />
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        onClick={() => beginEdit(vendor)}
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
