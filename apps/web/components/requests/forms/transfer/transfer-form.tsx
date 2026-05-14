"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignmentsApi, type PickerBranchAssignment } from "@/lib/api/assignments";
import { organizationApi, type Chain, type Vendor } from "@/lib/api/organization";
import { requestsApi, type RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { BranchChoiceList } from "./transfer-picker-search";
import { filterVendors } from "./transfer-utils";
import { EmptyState } from "../../shared/request-empty-state";
import { Definition, Field } from "../../shared/request-field";
import { ErrorState, LoadingState } from "../../shared/request-states";
import { formatEnum } from "../../shared/request-utils";

export function LifecyclePickerRequestForm({
  onCreated,
  type
}: {
  onCreated: (request: RequestSummary) => void;
  type: "TRANSFER";
}) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sourceChainId, setSourceChainId] = useState("");
  const [sourceVendorId, setSourceVendorId] = useState("");
  const [sourceBranchQuery, setSourceBranchQuery] = useState("");
  const [destinationChainId, setDestinationChainId] = useState("");
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [destinationBranchQuery, setDestinationBranchQuery] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerAssignments, setPickerAssignments] = useState<PickerBranchAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] =
    useState<PickerBranchAssignment | null>(null);
  const [form, setForm] = useState({
    reason: "",
    effectiveDate: "",
    notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    if (!sourceVendorId) {
      setPickerAssignments([]);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setPickerLoading(true);
      assignmentsApi
        .listPickerBranchAssignments({
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          q: pickerQuery || undefined
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
  }, [pickerQuery, sourceVendorId]);

  const sourceVendors = filterVendors(vendors, sourceChainId, sourceBranchQuery);
  const destinationVendors = filterVendors(
    vendors,
    destinationChainId,
    destinationBranchQuery
  ).filter((vendor) => vendor.id !== sourceVendorId);
  const sourceVendor = vendors.find((vendor) => vendor.id === sourceVendorId);
  const destinationVendor = vendors.find((vendor) => vendor.id === destinationVendorId);

  function selectSourceChain(chainId: string) {
    setSourceChainId(chainId);
    setSourceVendorId("");
    setSelectedAssignment(null);
    setPickerAssignments([]);
    setPickerQuery("");
    setSourceBranchQuery("");
  }

  function selectSourceVendor(vendor: Vendor) {
    setSourceChainId(vendor.chainId);
    setSourceVendorId(vendor.id);
    setSelectedAssignment(null);
    setPickerQuery("");
  }

  function selectDestinationChain(chainId: string) {
    setDestinationChainId(chainId);
    setDestinationVendorId("");
    setDestinationBranchQuery("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            <select
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              onChange={(event) => selectSourceChain(event.target.value)}
              value={sourceChainId}
            >
              <option value="">{loading ? "Loading Chains..." : "Select Chain"}</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch search">
            <Input
              className="h-11 rounded-xl bg-white"
              disabled={!sourceChainId || loading}
              onChange={(event) => setSourceBranchQuery(event.target.value)}
              placeholder="Search Branch"
              value={sourceBranchQuery}
            />
          </Field>
        </div>
        {sourceChainId ? (
          <BranchChoiceList
            onSelect={selectSourceVendor}
            selectedVendorId={sourceVendorId}
            vendors={sourceVendors}
          />
        ) : null}
      </div>

      {sourceVendor ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <span className="font-semibold">{sourceVendor.chain.chainName}</span>
          <span className="mx-2 text-orange-400">/</span>
          <span>{sourceVendor.vendorName}</span>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Field label="Picker search">
          <Input
            className="h-11 rounded-xl"
            disabled={!sourceVendorId}
            onChange={(event) => setPickerQuery(event.target.value)}
            placeholder="Search by name, phone, or ID"
            value={pickerQuery}
          />
        </Field>
        {pickerLoading ? (
          <LoadingState label="Loading active Pickers" />
        ) : sourceVendorId ? (
          <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pickerAssignments.slice(0, 12).map((assignment) => (
              <button
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-colors",
                  selectedAssignment?.id === assignment.id
                    ? "border-orange-300 bg-orange-50"
                    : "border-slate-200 bg-slate-50 hover:border-orange-200"
                )}
                key={assignment.id}
                onClick={() => setSelectedAssignment(assignment)}
                type="button"
              >
                <span className="block font-semibold text-slate-950">
                  {assignment.picker.nameEn}
                </span>
                <span className="block text-xs text-slate-500">
                  {assignment.picker.phoneNumber} · {assignment.vendor.vendorName}
                </span>
              </button>
            ))}
            {!pickerAssignments.length ? (
              <EmptyState message="No active Picker matches this Branch/search." compact />
            ) : null}
          </div>
        ) : null}
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
            <select
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              disabled={loading}
              onChange={(event) => selectDestinationChain(event.target.value)}
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
            </select>
          </Field>
          <Field label="Destination Branch search">
            <Input
              className="h-11 rounded-xl bg-white"
              disabled={!destinationChainId || loading}
              onChange={(event) => setDestinationBranchQuery(event.target.value)}
              placeholder="Search destination Branch"
              value={destinationBranchQuery}
            />
          </Field>
        </div>
        {destinationChainId ? (
          <BranchChoiceList
            onSelect={(vendor) => {
              setDestinationChainId(vendor.chainId);
              setDestinationVendorId(vendor.id);
            }}
            selectedVendorId={destinationVendorId}
            vendors={destinationVendors}
          />
        ) : null}
        {destinationVendor ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
            {destinationVendor.chain.chainName} / {destinationVendor.vendorName}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Transfer date">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) =>
              setForm((current) => ({ ...current, effectiveDate: event.target.value }))
            }
            type="date"
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
      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-orange-600 hover:bg-orange-700"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Submitting..." : `Submit ${formatEnum(type)}`}
        </Button>
      </div>
    </form>
  );
}
