"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { assignmentsApi } from "@/lib/api/assignments";
import { organizationApi, type Chain, type Vendor } from "@/lib/api/organization";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import {
  type ChampBranch,
  type ScopedPicker,
  workspacesApi
} from "@/lib/api/workspaces";
import { filterVendors } from "./transfer-utils";
import { Definition, Field } from "../../shared/request-field";
import { ErrorState, LoadingState } from "../../shared/request-states";
import { type InitialTransferPicker } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

type LifecyclePickerRequestFormProps = {
  initialPicker?: InitialTransferPicker | null;
  onCancel?: () => void;
  onCreated: (request: RequestSummary) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  type: "TRANSFER";
};

type TransferPickerOption = {
  id: string;
  pickerId: string;
  vendorId: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  picker: {
    id: string;
    nameEn: string;
    phoneNumber?: string | null;
  };
  vendor: {
    id: string;
    vendorName: string;
    vendorCode: string;
    chainId: string;
  };
  chain: Pick<Chain, "id" | "chainName" | "chainCode" | "status">;
};

export function LifecyclePickerRequestForm(props: LifecyclePickerRequestFormProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingState label="Loading workspace access" />;
  }

  if (user?.role === "CHAMP") {
    return <ChampScopedTransferRequestForm {...props} />;
  }

  return <OrganizationTransferRequestForm {...props} />;
}

function OrganizationTransferRequestForm({
  initialPicker,
  onCancel,
  onCreated,
  onDirtyChange,
  type
}: LifecyclePickerRequestFormProps) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sourceChainId, setSourceChainId] = useState("");
  const [sourceVendorId, setSourceVendorId] = useState("");
  const [destinationChainId, setDestinationChainId] = useState("");
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [pickerAssignments, setPickerAssignments] = useState<TransferPickerOption[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<TransferPickerOption | null>(null);
  const [form, setForm] = useState({
    reason: "",
    effectiveDate: "",
    notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialContextError, setInitialContextError] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const initialPickerOption = useMemo(
    () => toTransferPickerOption(initialPicker),
    [initialPicker]
  );

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      setLoading(true);
      try {
        const [chainFirst, vendorFirst] = await Promise.all([
          organizationApi.listChains({ page: 1, pageSize: 100, status: "ACTIVE" }),
          organizationApi.listVendors({ page: 1, pageSize: 100, status: "ACTIVE" })
        ]);
        const [chainRest, vendorRest] = await Promise.all([
          Promise.all(
            Array.from(
              { length: Math.max(0, chainFirst.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listChains({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          ),
          Promise.all(
            Array.from(
              { length: Math.max(0, vendorFirst.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listVendors({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          )
        ]);

        if (mounted) {
          setChains([...chainFirst.items, ...chainRest.flatMap((page) => page.items)]);
          setVendors([...vendorFirst.items, ...vendorRest.flatMap((page) => page.items)]);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Chain and Branch options."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialPicker) {
      return;
    }

    if (initialPicker.user.role && initialPicker.user.role !== "PICKER") {
      const message = "Transfer can be started only for a Picker profile.";
      setInitialContextError(message);
      setError(message);
      return;
    }

    setInitialContextError(null);
    setError(null);

    if (initialPickerOption) {
      setSourceChainId(initialPickerOption.chain.id);
      setSourceVendorId(initialPickerOption.vendorId);
      setPickerAssignments([initialPickerOption]);
      setSelectedAssignment(initialPickerOption);
      return;
    }

    let mounted = true;
    setPickerLoading(true);
    assignmentsApi
      .listPickerBranchAssignments({
        page: 1,
        pageSize: 100,
        q: initialPicker.user.phoneNumber ?? initialPicker.user.nameEn,
        status: "ACTIVE"
      })
      .then((response) => {
        if (!mounted) {
          return;
        }

        const activeMatches = response.items.filter(
          (assignment) => assignment.pickerId === initialPicker.user.id
        );

        if (activeMatches.length > 1) {
          const message =
            "This Picker has multiple active Branch assignments. Resolve the assignment data before starting Transfer.";
          setInitialContextError(message);
          setError(message);
          setSelectedAssignment(null);
          return;
        }

        if (!activeMatches.length) {
          const message =
            "Selected Picker does not have one active Branch assignment available for Transfer.";
          setInitialContextError(message);
          setError(message);
          setSelectedAssignment(null);
          return;
        }

        const [assignment] = activeMatches;
        setSourceChainId(assignment.chain.id);
        setSourceVendorId(assignment.vendorId);
        setPickerAssignments(activeMatches);
        setSelectedAssignment(assignment);
      })
      .catch((caughtError) => {
        if (mounted) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load the selected Picker assignment.";
          setInitialContextError(message);
          setError(message);
          setSelectedAssignment(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setPickerLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [initialPicker, initialPickerOption]);

  useEffect(() => {
    if (!sourceVendorId) {
      setPickerAssignments([]);
      return;
    }

    if (
      initialPickerOption &&
      sourceVendorId === initialPickerOption.vendorId
    ) {
      setPickerAssignments([initialPickerOption]);
      setSelectedAssignment((current) => current ?? initialPickerOption);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setPickerLoading(true);
      assignmentsApi
        .listPickerBranchAssignments({
          page: 1,
          pageSize: 100,
          status: "ACTIVE"
        })
        .then((response) => {
          if (mounted) {
            setPickerAssignments(
              response.items.filter((assignment) => assignment.vendorId === sourceVendorId)
            );
          }
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to load active Pickers."
            );
          }
        })
        .finally(() => {
          if (mounted) {
            setPickerLoading(false);
          }
        });
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [initialPickerOption, sourceVendorId]);

  const sourceVendors = filterVendors(vendors, sourceChainId, "");
  const destinationVendors = filterVendors(
    vendors,
    destinationChainId,
    ""
  ).filter((vendor) => vendor.id !== sourceVendorId);
  const sourceVendor = vendors.find((vendor) => vendor.id === sourceVendorId);
  const destinationVendor = vendors.find((vendor) => vendor.id === destinationVendorId);

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        sourceChainId ||
          sourceVendorId ||
          selectedAssignment ||
          destinationChainId ||
          destinationVendorId ||
          form.reason.trim() ||
          form.effectiveDate ||
          form.notes.trim()
      )
    );
  }, [
    destinationChainId,
    destinationVendorId,
    form.effectiveDate,
    form.notes,
    form.reason,
    onDirtyChange,
    selectedAssignment,
    sourceChainId,
    sourceVendorId
  ]);

  function selectSourceChain(chainId: string) {
    setSourceChainId(chainId);
    setSourceVendorId("");
    setSelectedAssignment(null);
    setPickerAssignments([]);
  }

  function selectSourceVendor(vendor: Vendor) {
    setSourceChainId(vendor.chainId);
    setSourceVendorId(vendor.id);
    setSelectedAssignment(null);
  }

  function selectDestinationChain(chainId: string) {
    setDestinationChainId(chainId);
    setDestinationVendorId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (initialContextError) {
      setError(initialContextError);
      return;
    }
    if (!sourceVendorId || !selectedAssignment) {
      setError("Select Chain, Branch, and Picker before submitting.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (!destinationVendorId) {
      setError("Select destination Chain and Branch.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createTransfer({
          sourceVendorId,
          targetUserId: selectedAssignment.pickerId,
          destinationVendorId,
          reason: form.reason,
          requestedTransferDate: form.effectiveDate || undefined,
          notes: form.notes || undefined
        });
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : `Unable to submit ${formatEnum(type)} request.`
        );
      }
    });
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source Chain">
            <Select
              aria-label="Source Chain"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              emptyMessage="No Chain matches this search."
              onChange={(event) => selectSourceChain(event.target.value)}
              searchable
              searchPlaceholder="Search Chain"
              value={sourceChainId}
            >
              <option value="">{loading ? "Loading Chains..." : "Select Chain"}</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source Branch">
            <Select
              aria-label="Source Branch"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={!sourceChainId || loading}
              emptyMessage="No Branch matches this Chain/search."
              onChange={(event) => {
                const vendor = sourceVendors.find(
                  (item) => item.id === event.target.value
                );
                if (vendor) {
                  selectSourceVendor(vendor);
                }
              }}
              searchable
              searchPlaceholder="Search Branch"
              value={sourceVendorId}
            >
              <option value="">
                {sourceChainId ? "Select Branch" : "Select Chain first"}
              </option>
              {sourceVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName} / {vendor.vendorCode} / {vendor.chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {sourceVendor ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <span className="font-semibold">{sourceVendor.chain.chainName}</span>
          <span className="mx-2 text-orange-400">/</span>
          <span>{sourceVendor.vendorName}</span>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Field label="Picker">
          <Select
            aria-label="Picker"
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
            disabled={!sourceVendorId || pickerLoading}
            emptyMessage="No active Picker matches this Branch/search."
            onChange={(event) => {
              const assignment = pickerAssignments.find(
                (item) => item.id === event.target.value
              );
              setSelectedAssignment(assignment ?? null);
            }}
            searchable
            searchPlaceholder="Search by name, phone, or ID"
            value={selectedAssignment?.id ?? ""}
          >
            <option value="">
              {sourceVendorId
                ? pickerLoading
                  ? "Loading active Pickers..."
                  : "Select Picker"
                : "Select Branch first"}
            </option>
            {pickerAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.picker.nameEn} / {assignment.picker.phoneNumber} /{" "}
                {assignment.vendor.vendorName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {selectedAssignment ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-950">Selected Picker</p>
          <Definition label="Name" value={selectedAssignment.picker.nameEn} />
          <Definition label="Phone" value={selectedAssignment.picker.phoneNumber} />
          <Definition label="Branch" value={selectedAssignment.vendor.vendorName} />
          <Definition label="Chain" value={selectedAssignment.chain.chainName} />
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Destination Chain">
            <Select
              aria-label="Destination Chain"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              emptyMessage="No Chain matches this search."
              onChange={(event) => selectDestinationChain(event.target.value)}
              searchable
              searchPlaceholder="Search Chain"
              value={destinationChainId}
            >
              <option value="">
                {loading ? "Loading Chains..." : "Select Chain"}
              </option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destination Branch">
            <Select
              aria-label="Destination Branch"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={!destinationChainId || loading}
              emptyMessage="No destination Branch matches this Chain/search."
              onChange={(event) => {
                const vendor = destinationVendors.find(
                  (item) => item.id === event.target.value
                );
                if (vendor) {
                  setDestinationChainId(vendor.chainId);
                  setDestinationVendorId(vendor.id);
                }
              }}
              searchable
              searchPlaceholder="Search destination Branch"
              value={destinationVendorId}
            >
              <option value="">
                {destinationChainId ? "Select destination Branch" : "Select Chain first"}
              </option>
              {destinationVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName} / {vendor.vendorCode} / {vendor.chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {destinationVendor ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
            {destinationVendor.chain.chainName} / {destinationVendor.vendorName}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Transfer date">
          <DatePicker
            onChange={(value) =>
              setForm((current) => ({ ...current, effectiveDate: value }))
            }
            placeholder="Select transfer date"
            quickActions={["today"]}
            value={form.effectiveDate}
          />
        </Field>
        <Field label="Reason">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) =>
              setForm((current) => ({ ...current, reason: event.target.value }))
            }
            value={form.reason}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          value={form.notes}
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            className="min-h-11 w-full rounded-xl sm:w-auto"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          className="min-h-11 w-full rounded-xl bg-orange-600 hover:bg-orange-700 sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Submitting..." : `Submit ${formatEnum(type)}`}
        </Button>
      </div>
    </form>
  );
}

function ChampScopedTransferRequestForm({
  initialPicker,
  onCancel,
  onCreated,
  onDirtyChange,
  type
}: LifecyclePickerRequestFormProps) {
  const [branches, setBranches] = useState<ChampBranch[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sourceChainId, setSourceChainId] = useState("");
  const [sourceVendorId, setSourceVendorId] = useState("");
  const [destinationChainId, setDestinationChainId] = useState("");
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [selectedPicker, setSelectedPicker] = useState<ScopedPicker | null>(null);
  const [form, setForm] = useState({
    reason: "",
    effectiveDate: "",
    notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialContextError, setInitialContextError] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      setLoading(true);
      setError(null);
      try {
        const [branchesResponse, allVendors] = await Promise.all([
          workspacesApi.champBranches(),
          loadAllActiveVendors()
        ]);

        if (mounted) {
          const scopedBranches = branchesResponse.branches;
          setBranches(scopedBranches);
          setVendors(allVendors);
          if (scopedBranches.length === 1) {
            setSourceChainId(scopedBranches[0].chain.id);
            setSourceVendorId(scopedBranches[0].vendor.id);
          }
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load your scoped Transfer options."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialPicker || loading) {
      return;
    }

    if (initialPicker.user.role && initialPicker.user.role !== "PICKER") {
      const message = "Transfer can be started only for a Picker profile.";
      setInitialContextError(message);
      setError(message);
      return;
    }

    const matches = branches.flatMap((branch) =>
      branch.pickers
        .filter((picker) => picker.picker.id === initialPicker.user.id)
        .map((picker) => ({ branch, picker }))
    );

    if (matches.length > 1) {
      const message =
        "This Picker has multiple active Branch assignments in your workspace. Resolve the assignment data before starting Transfer.";
      setInitialContextError(message);
      setError(message);
      setSelectedPicker(null);
      return;
    }

    if (!matches.length) {
      const message =
        "Selected Picker is not active in your assigned Branches.";
      setInitialContextError(message);
      setError(message);
      setSelectedPicker(null);
      return;
    }

    const [{ branch, picker }] = matches;
    setInitialContextError(null);
    setError(null);
    setSourceChainId(branch.chain.id);
    setSourceVendorId(branch.vendor.id);
    setSelectedPicker(picker);
  }, [branches, initialPicker, loading]);

  const sourceChains = useMemo(() => {
    const chainsById = new Map<string, ChampBranch["chain"]>();
    branches.forEach((branch) => chainsById.set(branch.chain.id, branch.chain));
    return Array.from(chainsById.values()).sort((first, second) =>
      first.chainName.localeCompare(second.chainName)
    );
  }, [branches]);

  const destinationChains = useMemo(() => {
    const chainsById = new Map<string, Vendor["chain"]>();
    vendors.forEach((vendor) => chainsById.set(vendor.chain.id, vendor.chain));
    return Array.from(chainsById.values()).sort((first, second) =>
      first.chainName.localeCompare(second.chainName)
    );
  }, [vendors]);

  const sourceBranches = branches.filter(
    (branch) => !sourceChainId || branch.chain.id === sourceChainId
  );

  const selectedSourceBranch = branches.find(
    (branch) => branch.vendor.id === sourceVendorId
  );
  const pickerOptions = selectedSourceBranch?.pickers ?? [];
  const destinationVendors = filterVendors(
    vendors,
    destinationChainId,
    ""
  ).filter((vendor) => vendor.id !== sourceVendorId);
  const destinationVendor = vendors.find((vendor) => vendor.id === destinationVendorId);

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        selectedPicker ||
          destinationChainId ||
          destinationVendorId ||
          form.reason.trim() ||
          form.effectiveDate ||
          form.notes.trim()
      )
    );
  }, [
    destinationChainId,
    destinationVendorId,
    form.effectiveDate,
    form.notes,
    form.reason,
    onDirtyChange,
    selectedPicker
  ]);

  function selectSourceChain(chainId: string) {
    setSourceChainId(chainId);
    setSourceVendorId("");
    setSelectedPicker(null);
  }

  function selectSourceBranch(branch: ChampBranch) {
    setSourceChainId(branch.chain.id);
    setSourceVendorId(branch.vendor.id);
    setSelectedPicker(null);
  }

  function selectDestinationChain(chainId: string) {
    setDestinationChainId(chainId);
    setDestinationVendorId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (initialContextError) {
      setError(initialContextError);
      return;
    }

    if (!sourceVendorId || !selectedPicker) {
      setError("Select your source Branch and active Picker before submitting.");
      return;
    }

    if (!destinationVendorId) {
      setError("Select destination Chain and Branch.");
      return;
    }

    if (!form.reason.trim()) {
      setError("Reason is required.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createTransfer({
          sourceVendorId,
          targetUserId: selectedPicker.picker.id,
          destinationVendorId,
          reason: form.reason,
          requestedTransferDate: form.effectiveDate || undefined,
          notes: form.notes || undefined
        });
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : `Unable to submit ${formatEnum(type)} request.`
        );
      }
    });
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source Chain">
            <Select
              aria-label="Source Chain"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              emptyMessage="No Chain matches this search."
              onChange={(event) => selectSourceChain(event.target.value)}
              searchable
              searchPlaceholder="Search Chain"
              value={sourceChainId}
            >
              <option value="">
                {loading ? "Loading your Chains..." : "Select Chain"}
              </option>
              {sourceChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source Branch">
            <Select
              aria-label="Source Branch"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={!sourceChainId || loading}
              emptyMessage="No assigned Branch matches this Chain/search."
              onChange={(event) => {
                const branch = sourceBranches.find(
                  (item) => item.vendor.id === event.target.value
                );
                if (branch) {
                  selectSourceBranch(branch);
                }
              }}
              searchable
              searchPlaceholder="Search your Branch"
              value={sourceVendorId}
            >
              <option value="">
                {sourceChainId ? "Select Branch" : "Select Chain first"}
              </option>
              {sourceBranches.map((branch) => (
                <option key={branch.vendor.id} value={branch.vendor.id}>
                  {branch.vendor.vendorName} / {branch.vendor.vendorCode} /{" "}
                  {branch.chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {selectedSourceBranch ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <span className="font-semibold">
            {selectedSourceBranch.chain.chainName}
          </span>
          <span className="mx-2 text-orange-400">/</span>
          <span>{selectedSourceBranch.vendor.vendorName}</span>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Field label="Picker">
          <Select
            aria-label="Picker"
            className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
            disabled={!sourceVendorId}
            emptyMessage="No active Picker matches this Branch/search."
            onChange={(event) => {
              const picker = pickerOptions.find(
                (item) => item.assignment.id === event.target.value
              );
              setSelectedPicker(picker ?? null);
            }}
            searchable
            searchPlaceholder="Search by name, phone, or ID"
            value={selectedPicker?.assignment.id ?? ""}
          >
            <option value="">
              {sourceVendorId ? "Select Picker" : "Select Branch first"}
            </option>
            {pickerOptions.map((scopedPicker) => (
              <option
                key={scopedPicker.assignment.id}
                value={scopedPicker.assignment.id}
              >
                {scopedPicker.picker.nameEn} / {scopedPicker.picker.phoneNumber} /{" "}
                {selectedSourceBranch?.vendor.vendorName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {selectedPicker && selectedSourceBranch ? (
        <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-semibold text-emerald-950">Selected Picker</p>
          <Definition label="Name" value={selectedPicker.picker.nameEn} />
          <Definition label="Phone" value={selectedPicker.picker.phoneNumber} />
          <Definition
            label="Branch"
            value={selectedSourceBranch.vendor.vendorName}
          />
          <Definition label="Chain" value={selectedSourceBranch.chain.chainName} />
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Destination Chain">
            <Select
              aria-label="Destination Chain"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              emptyMessage="No Chain matches this search."
              onChange={(event) => selectDestinationChain(event.target.value)}
              searchable
              searchPlaceholder="Search Chain"
              value={destinationChainId}
            >
              <option value="">
                {loading ? "Loading Chains..." : "Select Chain"}
              </option>
              {destinationChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destination Branch">
            <Select
              aria-label="Destination Branch"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={!destinationChainId || loading}
              emptyMessage="No destination Branch matches this Chain/search."
              onChange={(event) => {
                const vendor = destinationVendors.find(
                  (item) => item.id === event.target.value
                );
                if (vendor) {
                  setDestinationChainId(vendor.chainId);
                  setDestinationVendorId(vendor.id);
                }
              }}
              searchable
              searchPlaceholder="Search destination Branch"
              value={destinationVendorId}
            >
              <option value="">
                {destinationChainId ? "Select destination Branch" : "Select Chain first"}
              </option>
              {destinationVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.vendorName} / {vendor.vendorCode} / {vendor.chain.chainName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {destinationVendor ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
            {destinationVendor.chain.chainName} / {destinationVendor.vendorName}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Transfer date">
          <DatePicker
            onChange={(value) =>
              setForm((current) => ({ ...current, effectiveDate: value }))
            }
            placeholder="Select transfer date"
            quickActions={["today"]}
            value={form.effectiveDate}
          />
        </Field>
        <Field label="Reason">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) =>
              setForm((current) => ({ ...current, reason: event.target.value }))
            }
            value={form.reason}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          value={form.notes}
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            className="min-h-11 w-full rounded-xl sm:w-auto"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          className="min-h-11 w-full rounded-xl bg-orange-600 hover:bg-orange-700 sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Submitting..." : `Submit ${formatEnum(type)}`}
        </Button>
      </div>
    </form>
  );
}

async function loadAllActiveVendors() {
  const firstPage = await organizationApi.listVendors({
    page: 1,
    pageSize: 100,
    status: "ACTIVE"
  });

  const restPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.meta.totalPages - 1) },
      (_, index) =>
        organizationApi.listVendors({
          page: index + 2,
          pageSize: 100,
          status: "ACTIVE"
        })
    )
  );

  return [firstPage.items, ...restPages.map((page) => page.items)].flat();
}

function toTransferPickerOption(
  initialPicker?: InitialTransferPicker | null
): TransferPickerOption | null {
  if (
    !initialPicker?.assignment ||
    !initialPicker.vendor ||
    !initialPicker.chain
  ) {
    return null;
  }

  return {
    id: initialPicker.assignment.id,
    pickerId: initialPicker.user.id,
    vendorId: initialPicker.vendor.id,
    status: initialPicker.assignment.status,
    startDate: initialPicker.assignment.startDate,
    endDate: initialPicker.assignment.endDate ?? null,
    picker: {
      id: initialPicker.user.id,
      nameEn: initialPicker.user.nameEn,
      phoneNumber: initialPicker.user.phoneNumber
    },
    vendor: {
      id: initialPicker.vendor.id,
      vendorName: initialPicker.vendor.vendorName,
      vendorCode: initialPicker.vendor.vendorCode,
      chainId: initialPicker.vendor.chainId
    },
    chain: initialPicker.chain
  };
}
