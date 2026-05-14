"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
  type SelectHTMLAttributes
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
  type AssignmentStatus,
  assignmentsApi,
  type ChainAreaManagerAssignment,
  type PickerBranchAssignment,
  type VendorChampAssignment
} from "@/lib/api/assignments";
import {
  type Chain,
  organizationApi,
  type PageMeta,
  type Vendor
} from "@/lib/api/organization";
import { usersApi } from "@/lib/api/users";
import type { SafeUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type AssignmentTab = "pickers" | "vendorChamps" | "chainAreaManagers";

const tabs: Array<{ id: AssignmentTab; label: string; description: string }> = [
  {
    id: "pickers",
    label: "Picker Branch",
    description: "View Picker assignment history from workflows."
  },
  {
    id: "vendorChamps",
    label: "Vendor Champ",
    description: "Assign one Champ to one active Vendor / Branch."
  },
  {
    id: "chainAreaManagers",
    label: "Chain Area Manager",
    description: "Assign one Area Manager to one active Chain."
  }
];

const vendorChampSchema = z.object({
  vendorId: z.string().uuid("Vendor is required."),
  champId: z.string().uuid("Champ is required."),
  startDate: z.string().optional()
});

const chainAreaManagerSchema = z.object({
  chainId: z.string().uuid("Chain is required."),
  areaManagerId: z.string().uuid("Area Manager is required."),
  startDate: z.string().optional()
});

type VendorChampFormValues = z.infer<typeof vendorChampSchema>;
type ChainAreaManagerFormValues = z.infer<typeof chainAreaManagerSchema>;

const DEFAULT_META: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
};

export function AssignmentsAdmin() {
  const [activeTab, setActiveTab] = useState<AssignmentTab>("pickers");
  const [pickerAssignments, setPickerAssignments] = useState<
    PickerBranchAssignment[]
  >([]);
  const [vendorChampAssignments, setVendorChampAssignments] = useState<
    VendorChampAssignment[]
  >([]);
  const [chainAreaManagerAssignments, setChainAreaManagerAssignments] = useState<
    ChainAreaManagerAssignment[]
  >([]);
  const [meta, setMeta] = useState<Record<AssignmentTab, PageMeta>>({
    pickers: DEFAULT_META,
    vendorChamps: DEFAULT_META,
    chainAreaManagers: DEFAULT_META
  });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [lookupQuery, setLookupQuery] = useState("");
  const deferredLookupQuery = useDeferredValue(lookupQuery);
  const [status, setStatus] = useState<AssignmentStatus | "">("ACTIVE");
  const [champs, setChamps] = useState<SafeUser[]>([]);
  const [areaManagers, setAreaManagers] = useState<SafeUser[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const vendorChampForm = useForm<VendorChampFormValues>({
    resolver: zodResolver(vendorChampSchema),
    defaultValues: { vendorId: "", champId: "", startDate: "" }
  });
  const chainAreaManagerForm = useForm<ChainAreaManagerFormValues>({
    resolver: zodResolver(chainAreaManagerSchema),
    defaultValues: { chainId: "", areaManagerId: "", startDate: "" }
  });

  async function loadLookups() {
    const [champUsers, areaManagerUsers, activeVendors, activeChains] =
      await Promise.all([
        usersApi.list({
          page: 1,
          pageSize: 100,
          role: "CHAMP",
          status: "ACTIVE",
          q: deferredLookupQuery
        }),
        usersApi.list({
          page: 1,
          pageSize: 100,
          role: "AREA_MANAGER",
          status: "ACTIVE",
          q: deferredLookupQuery
        }),
        organizationApi.listVendors({
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          q: deferredLookupQuery
        }),
        organizationApi.listChains({
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          q: deferredLookupQuery
        })
      ]);

    setChamps(champUsers.items);
    setAreaManagers(areaManagerUsers.items);
    setVendors(activeVendors.items);
    setChains(activeChains.items);
  }

  async function loadAssignments() {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        pageSize: 10,
        q: deferredQuery,
        status
      };
      const [pickerRows, vendorChampRows, chainAreaRows] = await Promise.all([
        assignmentsApi.listPickerBranchAssignments(params),
        assignmentsApi.listVendorChampAssignments(params),
        assignmentsApi.listChainAreaManagerAssignments(params)
      ]);

      setPickerAssignments(pickerRows.items);
      setVendorChampAssignments(vendorChampRows.items);
      setChainAreaManagerAssignments(chainAreaRows.items);
      setMeta({
        pickers: pickerRows.meta,
        vendorChamps: vendorChampRows.meta,
        chainAreaManagers: chainAreaRows.meta
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load assignments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLookups().catch((caughtError) => {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load assignment lookup data."
      );
    });
  }, [deferredLookupQuery]);

  useEffect(() => {
    void loadAssignments();
  }, [deferredQuery, page, status]);

  function createVendorChampAssignment(values: VendorChampFormValues) {
    startTransition(async () => {
      setError(null);
      try {
        await assignmentsApi.createVendorChampAssignment({
          vendorId: values.vendorId,
          champId: values.champId,
          startDate: values.startDate || undefined
        });
        vendorChampForm.reset({ vendorId: "", champId: "", startDate: "" });
        await loadAssignments();
      } catch (caughtError) {
        setError(toErrorMessage(caughtError, "Unable to assign Champ."));
      }
    });
  }

  function createChainAreaManagerAssignment(values: ChainAreaManagerFormValues) {
    startTransition(async () => {
      setError(null);
      try {
        await assignmentsApi.createChainAreaManagerAssignment({
          chainId: values.chainId,
          areaManagerId: values.areaManagerId,
          startDate: values.startDate || undefined
        });
        chainAreaManagerForm.reset({
          chainId: "",
          areaManagerId: "",
          startDate: ""
        });
        await loadAssignments();
      } catch (caughtError) {
        setError(
          toErrorMessage(caughtError, "Unable to assign Area Manager.")
        );
      }
    });
  }

  function closeAssignment(id: string) {
    if (!window.confirm("Close this active assignment? History will be preserved.")) {
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (activeTab === "vendorChamps") {
          await assignmentsApi.closeVendorChampAssignment(id);
        } else if (activeTab === "chainAreaManagers") {
          await assignmentsApi.closeChainAreaManagerAssignment(id);
        }
        await loadAssignments();
      } catch (caughtError) {
        setError(toErrorMessage(caughtError, "Unable to close assignment."));
      }
    });
  }

  const activeMeta = meta[activeTab];
  const activeItems =
    activeTab === "pickers"
      ? pickerAssignments
      : activeTab === "vendorChamps"
        ? vendorChampAssignments
        : chainAreaManagerAssignments;

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Assignment Engine Setup</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Set the operational hierarchy with assignment history preserved.
              This is admin setup only, not New Hire or Transfer workflow logic.
            </p>
          </div>
          <div className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
            One active assignment is enforced by PostgreSQL partial indexes.
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Search dropdown users, vendors, or chains"
            value={lookupQuery}
          />
          <Button onClick={() => void loadLookups()} type="button" variant="outline">
            Refresh lookups
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                activeTab === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              type="button"
            >
              <span className="block font-medium">{tab.label}</span>
              <span className="block text-xs opacity-80">{tab.description}</span>
            </button>
          ))}
        </div>

        {error ? <ErrorState message={error} /> : null}

        <div className="mt-4">
          {activeTab === "pickers" ? (
            <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Picker Branch assignments are created by New Hire and changed by
              Transfer or Resignation workflows only.
            </div>
          ) : null}

          {activeTab === "vendorChamps" ? (
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]"
              onSubmit={vendorChampForm.handleSubmit(
                createVendorChampAssignment
              )}
            >
              <FieldError
                error={vendorChampForm.formState.errors.vendorId?.message}
              >
                <SelectField
                  label="Vendor"
                  {...vendorChampForm.register("vendorId")}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorName} ({vendor.vendorCode})
                    </option>
                  ))}
                </SelectField>
              </FieldError>
              <FieldError error={vendorChampForm.formState.errors.champId?.message}>
                <SelectField
                  label="Champ"
                  {...vendorChampForm.register("champId")}
                >
                  <option value="">Select Champ</option>
                  {champs.map((champ) => (
                    <option key={champ.id} value={champ.id}>
                      {champ.nameEn} ({champ.phoneNumber})
                    </option>
                  ))}
                </SelectField>
              </FieldError>
              <Input
                aria-label="Start date"
                type="date"
                {...vendorChampForm.register("startDate")}
              />
              <Button disabled={isPending} type="submit">
                Assign
              </Button>
            </form>
          ) : null}

          {activeTab === "chainAreaManagers" ? (
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]"
              onSubmit={chainAreaManagerForm.handleSubmit(
                createChainAreaManagerAssignment
              )}
            >
              <FieldError
                error={chainAreaManagerForm.formState.errors.chainId?.message}
              >
                <SelectField
                  label="Chain"
                  {...chainAreaManagerForm.register("chainId")}
                >
                  <option value="">Select Chain</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.chainName} ({chain.chainCode})
                    </option>
                  ))}
                </SelectField>
              </FieldError>
              <FieldError
                error={
                  chainAreaManagerForm.formState.errors.areaManagerId?.message
                }
              >
                <SelectField
                  label="Area Manager"
                  {...chainAreaManagerForm.register("areaManagerId")}
                >
                  <option value="">Select Area Manager</option>
                  {areaManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.nameEn} ({manager.phoneNumber})
                    </option>
                  ))}
                </SelectField>
              </FieldError>
              <Input
                aria-label="Start date"
                type="date"
                {...chainAreaManagerForm.register("startDate")}
              />
              <Button disabled={isPending} type="submit">
                Assign
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <Input
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Search assignment users, vendors, or chains"
            value={query}
          />
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as AssignmentStatus | "");
            }}
            value={status}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {loading ? (
          <LoadingRows label="Loading assignments" />
        ) : activeItems.length === 0 ? (
          <EmptyState
            description={
              activeTab === "pickers"
                ? "Picker assignment history appears after New Hire, Transfer, or Resignation workflows run."
                : "Create an assignment to establish hierarchy setup."
            }
            title="No assignments found"
          />
        ) : activeTab === "pickers" ? (
          <PickerAssignmentsTable items={pickerAssignments} />
        ) : activeTab === "vendorChamps" ? (
          <VendorChampAssignmentsTable
            items={vendorChampAssignments}
            onClose={closeAssignment}
          />
        ) : (
          <ChainAreaManagerAssignmentsTable
            items={chainAreaManagerAssignments}
            onClose={closeAssignment}
          />
        )}

        <Pagination meta={activeMeta} page={page} setPage={setPage} />
      </section>
    </div>
  );
}

function PickerAssignmentsTable({ items }: { items: PickerBranchAssignment[] }) {
  return (
    <TableShell minWidth="980px">
      <thead className="border-b text-xs uppercase text-muted-foreground">
        <tr>
          <th className="py-3 pr-4">Picker</th>
          <th className="py-3 pr-4">Vendor</th>
          <th className="py-3 pr-4">Chain</th>
          <th className="py-3 pr-4">Status</th>
          <th className="py-3 pr-4">Dates</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr className="border-b last:border-0" key={item.id}>
            <UserCell user={item.picker} />
            <td className="py-3 pr-4">{item.vendor.vendorName}</td>
            <td className="py-3 pr-4">{item.chain.chainName}</td>
            <StatusCell status={item.status} />
            <DateCell endDate={item.endDate} startDate={item.startDate} />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function VendorChampAssignmentsTable({
  items,
  onClose
}: {
  items: VendorChampAssignment[];
  onClose: (id: string) => void;
}) {
  return (
    <TableShell minWidth="980px">
      <thead className="border-b text-xs uppercase text-muted-foreground">
        <tr>
          <th className="py-3 pr-4">Vendor</th>
          <th className="py-3 pr-4">Chain</th>
          <th className="py-3 pr-4">Champ</th>
          <th className="py-3 pr-4">Status</th>
          <th className="py-3 pr-4">Dates</th>
          <th className="py-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr className="border-b last:border-0" key={item.id}>
            <td className="py-3 pr-4">{item.vendor.vendorName}</td>
            <td className="py-3 pr-4">{item.chain.chainName}</td>
            <UserCell user={item.champ} />
            <StatusCell status={item.status} />
            <DateCell endDate={item.endDate} startDate={item.startDate} />
            <ActionCell id={item.id} onClose={onClose} status={item.status} />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ChainAreaManagerAssignmentsTable({
  items,
  onClose
}: {
  items: ChainAreaManagerAssignment[];
  onClose: (id: string) => void;
}) {
  return (
    <TableShell minWidth="860px">
      <thead className="border-b text-xs uppercase text-muted-foreground">
        <tr>
          <th className="py-3 pr-4">Chain</th>
          <th className="py-3 pr-4">Area Manager</th>
          <th className="py-3 pr-4">Status</th>
          <th className="py-3 pr-4">Dates</th>
          <th className="py-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr className="border-b last:border-0" key={item.id}>
            <td className="py-3 pr-4">{item.chain.chainName}</td>
            <UserCell user={item.areaManager} />
            <StatusCell status={item.status} />
            <DateCell endDate={item.endDate} startDate={item.startDate} />
            <ActionCell id={item.id} onClose={onClose} status={item.status} />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function SelectField({
  children,
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
      {...props}
    >
      {children}
    </select>
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

function TableShell({
  children,
  minWidth
}: {
  children: ReactNode;
  minWidth: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

function UserCell({ user }: { user: { nameEn: string; phoneNumber: string } }) {
  return (
    <td className="py-3 pr-4">
      <p className="font-medium">{user.nameEn}</p>
      <p className="text-xs text-muted-foreground">{user.phoneNumber}</p>
    </td>
  );
}

function StatusCell({ status }: { status: AssignmentStatus }) {
  return (
    <td className="py-3 pr-4">
      <StatusBadge status={status} />
    </td>
  );
}

function DateCell({
  endDate,
  startDate
}: {
  endDate: string | null;
  startDate: string;
}) {
  return (
    <td className="py-3 pr-4 text-muted-foreground">
      <p>Start: {formatDate(startDate)}</p>
      <p>End: {endDate ? formatDate(endDate) : "Open"}</p>
    </td>
  );
}

function ActionCell({
  id,
  onClose,
  status
}: {
  id: string;
  onClose: (id: string) => void;
  status: AssignmentStatus;
}) {
  return (
    <td className="py-3 text-right">
      <Button
        disabled={status !== "ACTIVE"}
        onClick={() => onClose(id)}
        size="sm"
        type="button"
        variant="outline"
      >
        Close
      </Button>
    </td>
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function toErrorMessage(caughtError: unknown, fallback: string) {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
