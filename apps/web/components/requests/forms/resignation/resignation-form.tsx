"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { organizationApi } from "@/lib/api/organization";
import { requestsApi, type OffboardingBlockDecision, type OffboardingPickerSearchItem, type OffboardingReasonCode, type RequestSummary, offboardingReasonLabels } from "@/lib/api/requests";
import { workspacesApi } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { BlockDecisionFields } from "./block-decision-fields";
import { PickerIdentityCard } from "./offboarding-picker-search";
import { offboardingReasonCodes } from "../../shared/request-constants";
import { Field } from "../../shared/request-field";
import { ErrorState } from "../../shared/request-states";
import { type InitialResignationPicker } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

type ResignationChainOption = {
  chainCode: string;
  chainName: string;
  id: string;
};

type ResignationVendorOption = {
  chain: ResignationChainOption;
  chainId: string;
  id: string;
  vendorCode: string;
  vendorName: string;
};

export function ResignationRequestForm({
  fixedSourceVendorId,
  initialPicker,
  onCancel,
  onDirtyChange,
  onCreated
}: {
  fixedSourceVendorId?: string;
  initialPicker?: InitialResignationPicker | null;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState(
    initialPicker?.phoneNumber ?? initialPicker?.nameEn ?? ""
  );
  const [chains, setChains] = useState<ResignationChainOption[]>([]);
  const [vendors, setVendors] = useState<ResignationVendorOption[]>([]);
  const [sourceChainId, setSourceChainId] = useState("");
  const [sourceVendorId, setSourceVendorId] = useState(fixedSourceVendorId ?? "");
  const [items, setItems] = useState<OffboardingPickerSearchItem[]>([]);
  const [selectedPicker, setSelectedPicker] =
    useState<OffboardingPickerSearchItem | null>(null);
  const [form, setForm] = useState({
    resignationDate: "",
    reasonCode: "BAD_ATTITUDE" as OffboardingReasonCode,
    reasonDetails: "",
    notes: "",
    blockDecision: "NO_BLOCK" as OffboardingBlockDecision,
    blockReason: ""
  });
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const isAreaManagerCreator = user?.role === "AREA_MANAGER";
  const initialQuery = initialPicker?.phoneNumber ?? initialPicker?.nameEn ?? "";

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      setContextLoading(true);
      setError(null);
      try {
        let nextChains: ResignationChainOption[] = [];
        let nextVendors: ResignationVendorOption[] = [];

        if (user?.role === "CHAMP") {
          const workspace = await workspacesApi.champBranches();
          nextVendors = workspace.branches.map((branch) => ({
            chain: toResignationChainOption(branch.chain),
            chainId: branch.chain.id,
            id: branch.vendor.id,
            vendorCode: branch.vendor.vendorCode,
            vendorName: branch.vendor.vendorName
          }));
          nextChains = uniqueResignationChains(
            workspace.branches.map((branch) =>
              toResignationChainOption(branch.chain)
            )
          );
        } else if (user?.role === "AREA_MANAGER") {
          const workspace = await workspacesApi.areaManager();
          nextChains = uniqueResignationChains(
            workspace.chains.map((chain) =>
              toResignationChainOption(chain.chain)
            )
          );
          nextVendors = workspace.chains.flatMap((chain) =>
            chain.vendors.map((branch) => ({
              chain: toResignationChainOption(chain.chain),
              chainId: chain.chain.id,
              id: branch.vendor.id,
              vendorCode: branch.vendor.vendorCode,
              vendorName: branch.vendor.vendorName
            }))
          );
        } else if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
          const [chainOptions, vendorOptions] = await Promise.all([
            loadAllActiveResignationChains(),
            loadAllActiveResignationVendors()
          ]);
          nextChains = chainOptions;
          nextVendors = vendorOptions;
        }

        if (!mounted) {
          return;
        }

        const scopedVendors = fixedSourceVendorId
          ? nextVendors.filter((vendor) => vendor.id === fixedSourceVendorId)
          : nextVendors;
        const scopedChains = uniqueResignationChains(
          scopedVendors.map((vendor) => vendor.chain)
        );
        const nextVendor =
          fixedSourceVendorId
            ? scopedVendors.find((vendor) => vendor.id === fixedSourceVendorId)
            : scopedVendors.length === 1
              ? scopedVendors[0]
              : null;

        setChains(scopedChains.length ? scopedChains : nextChains);
        setVendors(scopedVendors);
        setSourceVendorId(nextVendor?.id ?? "");
        setSourceChainId(
          nextVendor?.chainId ?? (scopedChains.length === 1 ? scopedChains[0].id : "")
        );
        setSelectedPicker(null);
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load resignation context."
          );
        }
      } finally {
        if (mounted) {
          setContextLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      mounted = false;
    };
  }, [fixedSourceVendorId, user?.role]);

  useEffect(() => {
    if (!sourceVendorId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestsApi
        .searchOffboardingPickers({
          q: query.trim() || undefined,
          sourceVendorId
        })
        .then((response) => {
          if (!mounted) return;
          setItems(response.items);
          if (!selectedPicker && initialPicker?.id) {
            const match = response.items.find(
              (item) => item.pickerId === initialPicker.id
            );
            if (match) setSelectedPicker(match);
          }
        })
        .catch((caughtError) => {
          if (mounted) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to search active Pickers."
            );
          }
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [initialPicker?.id, query, sourceVendorId]);

  const sourceVendors = useMemo(
    () => vendors.filter((vendor) => !sourceChainId || vendor.chainId === sourceChainId),
    [sourceChainId, vendors]
  );
  const selectedPickerChanged = Boolean(
    selectedPicker && selectedPicker.pickerId !== initialPicker?.id
  );

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        selectedPickerChanged ||
          (query.trim() && query.trim() !== initialQuery.trim()) ||
          form.resignationDate ||
          form.reasonCode !== "BAD_ATTITUDE" ||
          form.reasonDetails.trim() ||
          form.notes.trim() ||
          form.blockDecision !== "NO_BLOCK" ||
          form.blockReason.trim()
      )
    );
  }, [
    form.blockDecision,
    form.blockReason,
    form.notes,
    form.reasonCode,
    form.reasonDetails,
    form.resignationDate,
    initialQuery,
    onDirtyChange,
    query,
    selectedPickerChanged
  ]);

  function selectSourceChain(chainId: string) {
    const branchOptions = vendors.filter((vendor) => vendor.chainId === chainId);
    setSourceChainId(chainId);
    setSourceVendorId(branchOptions.length === 1 ? branchOptions[0].id : "");
    setSelectedPicker(null);
    setQuery("");
  }

  function selectSourceVendor(vendorId: string) {
    const vendor = vendors.find((item) => item.id === vendorId);
    setSourceVendorId(vendorId);
    setSourceChainId(vendor?.chainId ?? sourceChainId);
    setSelectedPicker(null);
    setQuery("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPicker) {
      setError("Select an active Picker before submitting.");
      return;
    }
    if (selectedPicker.hasPendingResignation) {
      setError("This Picker already has a pending Resignation request.");
      return;
    }
    if (!form.resignationDate) {
      setError("Last working day is required.");
      return;
    }
    if (form.reasonCode === "OTHER" && !form.reasonDetails.trim()) {
      setError("Reason details are required when the reason is Other.");
      return;
    }
    if (
      isAreaManagerCreator &&
      form.blockDecision !== "NO_BLOCK" &&
      !form.blockReason.trim()
    ) {
      setError("Block reason is required for any block decision.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createOffboarding({
          type: "RESIGNATION",
          sourceVendorId: selectedPicker.vendorId,
          targetUserId: selectedPicker.pickerId,
          resignationDate: form.resignationDate,
          reasonCode: form.reasonCode,
          ...(form.reasonDetails.trim()
            ? { reasonDetails: form.reasonDetails.trim() }
            : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(isAreaManagerCreator
            ? {
                blockDecision: form.blockDecision,
                ...(form.blockReason.trim()
                  ? { blockReason: form.blockReason.trim() }
                  : {})
              }
            : {})
        });
        setCreatedRequest(created);
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit Resignation request."
        );
      }
    });
  }

  if (createdRequest) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Resignation request submitted.</p>
            <p className="mt-1">
              Status: {formatEnum(createdRequest.status)}. Current step:{" "}
              {createdRequest.currentStep
                ? formatEnum(createdRequest.currentStep)
                : "None"}.
            </p>
            <Link
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "mt-3 bg-white"
              )}
              href={`/tickets?requestId=${createdRequest.id}`}
              prefetch
            >
              Open request detail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="grid min-w-0 gap-5" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">Operational context</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Select the Chain and Branch that owns this Resignation request.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source Chain">
            <Select
              aria-label="Source Chain"
              disabled={contextLoading || Boolean(fixedSourceVendorId)}
              emptyMessage="No Chain matches this search."
              onChange={(event) => selectSourceChain(event.target.value)}
              searchable
              searchPlaceholder="Search Chain"
              value={sourceChainId}
            >
              <option value="">
                {contextLoading ? "Loading Chains..." : "Select Chain"}
              </option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.chainName} / {chain.chainCode}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source Branch">
            <Select
              aria-label="Source Branch"
              disabled={
                contextLoading ||
                !sourceChainId ||
                Boolean(fixedSourceVendorId)
              }
              emptyMessage="No Branch matches this Chain/search."
              onChange={(event) => selectSourceVendor(event.target.value)}
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

      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">Picker</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Search inside the selector by name, phone, shopper ID, Branch, or Chain.
          </p>
        </div>
        <div>
          <Field label="Picker">
            <Select
              aria-label="Picker"
              disabled={!sourceVendorId || loading}
              emptyMessage="No active scoped Picker matches this search."
              onChange={(event) => {
                const picker = items.find(
                  (item) => item.assignmentId === event.target.value
                );
                setSelectedPicker(picker ?? null);
              }}
              onSearchChange={(value) => {
                setQuery(value);
                setSelectedPicker(null);
              }}
              searchable
              searchPlaceholder="Search by name, phone, shopper ID, Branch, or Chain"
              searchValue={query}
              value={selectedPicker?.assignmentId ?? ""}
            >
              <option value="">
                {sourceVendorId
                  ? loading
                    ? "Searching active Pickers..."
                    : "Select Picker"
                  : "Select Branch first"}
              </option>
              {items.map((item) => (
                <option key={item.assignmentId} value={item.assignmentId}>
                  {item.picker.nameEn} / {item.picker.phoneNumber} /{" "}
                  {item.vendor.vendorName}
                  {item.hasPendingResignation ? " / Pending" : " / Active"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {selectedPicker ? <PickerIdentityCard picker={selectedPicker} /> : null}

      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[13rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-slate-950">Resignation details</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Last working day and reason are required before approval routing.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Last working day">
            <DatePicker
              maxYear={new Date().getFullYear() + 1}
              minYear={new Date().getFullYear() - 1}
              onChange={(value) =>
                setForm((current) => ({ ...current, resignationDate: value }))
              }
              quickActions={["yesterday", "today"]}
              value={form.resignationDate}
            />
          </Field>
          <Field label="Reason">
            <Select
              aria-label="Reason"
              className="h-11 rounded-xl border border-input bg-white px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reasonCode: event.target.value as OffboardingReasonCode,
                  reasonDetails:
                    event.target.value === "OTHER" ? current.reasonDetails : ""
                }))
              }
              value={form.reasonCode}
            >
              {offboardingReasonCodes.map((reasonCode) => (
                <option key={reasonCode} value={reasonCode}>
                  {offboardingReasonLabels[reasonCode]}
                </option>
              ))}
            </Select>
          </Field>
          {form.reasonCode === "OTHER" ? (
            <Field label="Reason details">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reasonDetails: event.target.value
                  }))
                }
                placeholder="Required for Other"
                value={form.reasonDetails}
              />
            </Field>
          ) : null}
          <Field label="Notes">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Optional"
              value={form.notes}
            />
          </Field>
        </div>
      </div>

      {isAreaManagerCreator ? (
        <BlockDecisionFields
          blockDecision={form.blockDecision}
          blockReason={form.blockReason}
          onChange={(patch) =>
            setForm((current) => ({
              ...current,
              ...patch,
              blockReason:
                patch.blockDecision === "NO_BLOCK"
                  ? ""
                  : patch.blockReason ?? current.blockReason
            }))
          }
          title="Area Manager block recommendation"
        />
      ) : null}

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
          className="min-h-11 w-full rounded-xl bg-orange-600 px-5 text-white hover:bg-orange-700 sm:w-auto"
          disabled={isPending || selectedPicker?.hasPendingResignation}
          type="submit"
        >
          {isPending ? "Submitting..." : "Submit Resignation"}
        </Button>
      </div>
    </form>
  );
}

function toResignationChainOption(chain: {
  chainCode: string;
  chainName: string;
  id: string;
}): ResignationChainOption {
  return {
    chainCode: chain.chainCode,
    chainName: chain.chainName,
    id: chain.id
  };
}

function uniqueResignationChains(chains: ResignationChainOption[]) {
  const byId = new Map<string, ResignationChainOption>();
  chains.forEach((chain) => byId.set(chain.id, chain));
  return Array.from(byId.values()).sort((first, second) =>
    first.chainName.localeCompare(second.chainName)
  );
}

async function loadAllActiveResignationChains() {
  const firstPage = await organizationApi.listChains({
    page: 1,
    pageSize: 100,
    status: "ACTIVE"
  });
  const restPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.meta.totalPages - 1) },
      (_, index) =>
        organizationApi.listChains({
          page: index + 2,
          pageSize: 100,
          status: "ACTIVE"
        })
    )
  );

  return uniqueResignationChains(
    [firstPage.items, ...restPages.map((page) => page.items)]
      .flat()
      .map((chain) => toResignationChainOption(chain))
  );
}

async function loadAllActiveResignationVendors() {
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

  return [firstPage.items, ...restPages.map((page) => page.items)]
    .flat()
    .map((vendor) => ({
      chain: toResignationChainOption(vendor.chain),
      chainId: vendor.chainId,
      id: vendor.id,
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName
    }));
}
