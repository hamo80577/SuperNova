"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { organizationApi } from "@/lib/api/organization";
import { workspacesApi } from "@/lib/api/workspaces";
import { requestsApi, type NewHireLookupResponse, type NewHireTargetRole, type RequestSummary } from "@/lib/api/requests";
import { cn } from "@/lib/utils";
import { SelectedContextCard } from "./new-hire-branch-context";
import { NewHireLookupResultCard, PreviousPickerCard } from "./new-hire-lookup";
import { NewHireFormSection } from "./new-hire-section";
import { applyFixedNewHireBranch, getAllowedNewHireTargetRoles, getNewHireSubmitLabel, isActiveNewHireEntity, isBlockingNewHireDecision, isValidEgyptNationalId, isValidEgyptPhone, toNewHireChainOption, toNewHireVendorOption, uniqueNewHireChains } from "./new-hire-utils";
import { EmptyState } from "../../shared/request-empty-state";
import { Field } from "../../shared/request-field";
import { ErrorState } from "../../shared/request-states";
import { type LockedNewHireBranchContext, type NewHireChainOption, type NewHireVendorOption } from "../../shared/request-types";
import { formatEnum } from "../../shared/request-utils";

export function NewHireRequestForm({
  fixedSourceVendorId,
  initialTargetRole = "PICKER",
  lockedBranchContext,
  lockTargetRole = false,
  onDirtyChange,
  onCreated
}: {
  fixedSourceVendorId?: string;
  initialTargetRole?: NewHireTargetRole;
  lockedBranchContext?: LockedNewHireBranchContext;
  lockTargetRole?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onCreated: (request: RequestSummary) => void;
}) {
  const { user } = useAuth();
  const [chains, setChains] = useState<NewHireChainOption[]>([]);
  const [vendors, setVendors] = useState<NewHireVendorOption[]>([]);
  const [form, setForm] = useState({
    targetRole: initialTargetRole,
    sourceChainId: "",
    sourceVendorId: "",
    chainIds: [] as string[],
    nameEn: "",
    nameAr: "",
    phoneNumber: "",
    nationalId: "",
    dateOfBirth: "",
    gender: "UNSPECIFIED" as "MALE" | "FEMALE" | "UNSPECIFIED",
    address: "",
    notes: ""
  });
  const [chainQuery, setChainQuery] = useState("");
  const [branchQuery, setBranchQuery] = useState("");
  const [lookupResponse, setLookupResponse] =
    useState<NewHireLookupResponse | null>(null);
  const [selectedRehireUserId, setSelectedRehireUserId] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "checking" | "checked">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isPending, startTransition] = useTransition();
  const branchLocked = Boolean(fixedSourceVendorId);

  const allowedTargetRoles = useMemo(
    () => getAllowedNewHireTargetRoles(user?.role, branchLocked),
    [branchLocked, user?.role]
  );

  useEffect(() => {
    if (fixedSourceVendorId) {
      setForm((current) => ({ ...current, sourceVendorId: fixedSourceVendorId }));
    }
    let mounted = true;
    async function loadVendors() {
      setIsLoadingVendors(true);
      setError(null);
      try {
        if (fixedSourceVendorId && lockedBranchContext) {
          const chainOption = toNewHireChainOption(lockedBranchContext.chain);
          const vendorOption = toNewHireVendorOption(
            lockedBranchContext.vendor,
            chainOption
          );
          if (mounted) {
            setChains([chainOption]);
            setVendors([vendorOption]);
            applyFixedNewHireBranch(fixedSourceVendorId, [vendorOption], setForm);
          }
          return;
        }

        if (user?.role === "CHAMP") {
          const workspace = await workspacesApi.champBranches();
          if (!mounted) {
            return;
          }

          const visibleBranches = workspace.branches.filter(
            (branch) =>
              isActiveNewHireEntity(branch.chain) &&
              isActiveNewHireEntity(branch.vendor) &&
              (!fixedSourceVendorId || branch.vendor.id === fixedSourceVendorId)
          );
          const chainOptions = uniqueNewHireChains(
            visibleBranches.map((branch) => toNewHireChainOption(branch.chain))
          );
          const vendorOptions = visibleBranches.map((branch) =>
            toNewHireVendorOption(branch.vendor, branch.chain)
          );

          setChains(chainOptions);
          setVendors(vendorOptions);
          applyFixedNewHireBranch(fixedSourceVendorId, vendorOptions, setForm);
          return;
        }

        if (user?.role === "AREA_MANAGER") {
          const workspace = await workspacesApi.areaManager();
          if (!mounted) {
            return;
          }

          const activeChains = workspace.chains.filter((chain) =>
            isActiveNewHireEntity(chain.chain)
          );
          const chainOptions = uniqueNewHireChains(
            activeChains.map((chain) => toNewHireChainOption(chain.chain))
          );
          const vendorOptions = activeChains.flatMap((chain) =>
            chain.vendors
              .filter(
                (branch) =>
                  isActiveNewHireEntity(branch.vendor) &&
                  (!fixedSourceVendorId ||
                    branch.vendor.id === fixedSourceVendorId)
              )
              .map((branch) => toNewHireVendorOption(branch.vendor, chain.chain))
          );

          setChains(chainOptions);
          setVendors(vendorOptions);
          applyFixedNewHireBranch(fixedSourceVendorId, vendorOptions, setForm);
          return;
        }

        if (fixedSourceVendorId) {
          if (mounted) {
            setChains([]);
            setVendors([]);
            setError("Selected Branch context was not provided.");
          }
          return;
        }

        if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
          const [chainFirst, first] = await Promise.all([
            organizationApi.listChains({
              page: 1,
              pageSize: 100,
              status: "ACTIVE"
            }),
            organizationApi.listVendors({
              page: 1,
              pageSize: 100,
              status: "ACTIVE"
            })
          ]);
          const rest = await Promise.all(
            Array.from(
              { length: Math.max(0, first.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listVendors({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          );
          const chainRest = await Promise.all(
            Array.from(
              { length: Math.max(0, chainFirst.meta.totalPages - 1) },
              (_, index) =>
                organizationApi.listChains({
                  page: index + 2,
                  pageSize: 100,
                  status: "ACTIVE"
                })
            )
          );

          if (mounted) {
            const allChains = [
              ...chainFirst.items,
              ...chainRest.flatMap((page) => page.items)
            ].map((chain) => toNewHireChainOption(chain));
            const allVendors = [
              ...first.items,
              ...rest.flatMap((page) => page.items)
            ].map((vendor) => toNewHireVendorOption(vendor));

            setChains(allChains);
            setVendors(allVendors);
          }
          return;
        }

        if (mounted) {
          setChains([]);
          setVendors([]);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load Branches."
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingVendors(false);
        }
      }
    }
    void loadVendors();
    return () => {
      mounted = false;
    };
  }, [fixedSourceVendorId, lockedBranchContext, user?.role]);

  useEffect(() => {
    if (!allowedTargetRoles.length) {
      return;
    }
    setForm((current) =>
      allowedTargetRoles.includes(current.targetRole)
        ? current
        : {
            ...current,
            targetRole: allowedTargetRoles[0],
            chainIds: [],
            sourceChainId: fixedSourceVendorId ? current.sourceChainId : "",
            sourceVendorId: fixedSourceVendorId ?? ""
          }
    );
  }, [allowedTargetRoles, fixedSourceVendorId]);

  useEffect(() => {
    if (!lockTargetRole) {
      return;
    }

    setForm((current) =>
      current.targetRole === initialTargetRole
        ? current
        : {
            ...current,
            targetRole: initialTargetRole,
            chainIds: initialTargetRole === "AREA_MANAGER" ? current.chainIds : [],
            sourceChainId:
              initialTargetRole === "AREA_MANAGER" && !fixedSourceVendorId
                ? ""
                : current.sourceChainId,
            sourceVendorId:
              initialTargetRole === "AREA_MANAGER" && !fixedSourceVendorId
                ? ""
                : current.sourceVendorId
          }
    );
  }, [fixedSourceVendorId, initialTargetRole, lockTargetRole]);

  useEffect(() => {
    if (isLoadingVendors || branchLocked) {
      return;
    }

    setForm((current) => {
      if (current.targetRole === "AREA_MANAGER") {
        if (current.chainIds.length || chains.length !== 1) {
          return current;
        }

        return {
          ...current,
          chainIds: [chains[0].id],
          sourceChainId: chains[0].id
        };
      }

      if (current.sourceVendorId) {
        return current;
      }

      const nextChainId =
        current.sourceChainId || (chains.length === 1 ? chains[0].id : "");
      const branchOptions = vendors.filter(
        (vendor) => !nextChainId || vendor.chainId === nextChainId
      );
      const nextVendorId = branchOptions.length === 1 ? branchOptions[0].id : "";

      if (
        nextChainId === current.sourceChainId &&
        nextVendorId === current.sourceVendorId
      ) {
        return current;
      }

      return {
        ...current,
        sourceChainId: nextChainId,
        sourceVendorId: nextVendorId
      };
    });
  }, [branchLocked, chains, form.targetRole, isLoadingVendors, vendors]);

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        form.nameEn.trim() ||
          form.nameAr.trim() ||
          form.phoneNumber.trim() ||
          form.nationalId.trim() ||
          form.dateOfBirth ||
          form.gender !== "UNSPECIFIED" ||
          form.address.trim() ||
          form.notes.trim()
      )
    );
  }, [
    form.address,
    form.dateOfBirth,
    form.gender,
    form.nameAr,
    form.nameEn,
    form.nationalId,
    form.notes,
    form.phoneNumber,
    onDirtyChange
  ]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetLookup() {
    setLookupResponse(null);
    setLookupState("idle");
    setSelectedRehireUserId("");
  }

  function updateTargetRole(targetRole: NewHireTargetRole) {
    setError(null);
    resetLookup();
    setForm((current) => ({
      ...current,
      targetRole,
      chainIds: targetRole === "AREA_MANAGER" ? current.chainIds : [],
      sourceChainId:
        targetRole === "AREA_MANAGER" && !fixedSourceVendorId
          ? ""
          : current.sourceChainId,
      sourceVendorId:
        targetRole === "AREA_MANAGER" && !fixedSourceVendorId
          ? ""
          : current.sourceVendorId
    }));
  }

  function updateIdentityField(name: "phoneNumber" | "nationalId", value: string) {
    const numericValue = value.replace(/\D/g, "");
    setForm((current) => ({
      ...current,
      [name]: numericValue
    }));
    resetLookup();
    setError(null);
  }

  const isPhoneValid = isValidEgyptPhone(form.phoneNumber);
  const isNationalIdValid = isValidEgyptNationalId(form.nationalId);
  const isBranchTarget = form.targetRole === "PICKER" || form.targetRole === "CHAMP";
  const isAreaManagerTarget = form.targetRole === "AREA_MANAGER";
  const selectedVendor = vendors.find((vendor) => vendor.id === form.sourceVendorId);
  const selectedChain = chains.find((chain) => chain.id === form.sourceChainId);
  const selectedChains = chains.filter((chain) => form.chainIds.includes(chain.id));
  const lookupContextReady = isAreaManagerTarget
    ? form.chainIds.length > 0
    : Boolean(form.sourceVendorId);
  const canLookupCandidate =
    lookupContextReady && (isPhoneValid || isNationalIdValid);
  const chainSearchResults = chains
    .filter((chain) => {
      const query = chainQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [chain.chainName, chain.chainCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .slice(0, 10);
  const filteredVendors = vendors
    .filter((vendor) => !form.sourceChainId || vendor.chainId === form.sourceChainId)
    .filter((vendor) => {
      const query = branchQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [vendor.vendorName, vendor.vendorCode, vendor.chain.chainName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  const lookupStatus = lookupResponse?.status;
  const lookupCandidates = lookupResponse?.candidates ?? [];
  const rehireCandidate =
    form.targetRole === "PICKER"
      ? lookupCandidates.find((candidate) => candidate.decision === "REHIRE_AVAILABLE")
      : undefined;
  const blockingCandidate = lookupCandidates.find((candidate) =>
    isBlockingNewHireDecision(candidate.decision)
  );
  const canShowCandidateForm = lookupStatus === "CLEAR";
  const canSubmit =
    !isPending &&
    lookupContextReady &&
    isPhoneValid &&
    isNationalIdValid &&
    (lookupStatus === "CLEAR" || lookupStatus === "REHIRE_AVAILABLE") &&
    !blockingCandidate &&
    (lookupStatus !== "CLEAR" || Boolean(form.nameEn.trim())) &&
    (lookupStatus !== "REHIRE_AVAILABLE" || Boolean(selectedRehireUserId));

  useEffect(() => {
    const phoneNumber = form.phoneNumber.trim();
    const nationalId = form.nationalId.trim();

    if (!canLookupCandidate) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLookupState("checking");
      startTransition(async () => {
        try {
          const result = await requestsApi.lookupNewHireCandidate({
            targetRole: form.targetRole,
            sourceVendorId: form.sourceVendorId || undefined,
            sourceChainId: form.sourceChainId || undefined,
            chainIds: isAreaManagerTarget ? form.chainIds : undefined,
            phoneNumber: isPhoneValid ? phoneNumber : undefined,
            nationalId: isNationalIdValid ? nationalId : undefined
          });
          if (cancelled) {
            return;
          }

          const rehireCandidate = result.candidates.find(
            (candidate) => candidate.decision === "REHIRE_AVAILABLE"
          );
          setLookupResponse(result);
          setSelectedRehireUserId(rehireCandidate?.user.id ?? "");
          setLookupState("checked");
        } catch (caughtError) {
          if (!cancelled) {
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Unable to lookup candidate."
            );
            setLookupState("idle");
          }
        }
      });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    canLookupCandidate,
    form.chainIds,
    form.nationalId,
    form.phoneNumber,
    form.sourceChainId,
    form.sourceVendorId,
    form.targetRole,
    isAreaManagerTarget,
    isNationalIdValid,
    isPhoneValid
  ]);

  function updateSourceChain(chainId: string) {
    setForm((current) => ({
      ...current,
      sourceChainId: chainId,
      sourceVendorId: ""
    }));
    setBranchQuery("");
    resetLookup();
  }

  function selectBranch(vendor: NewHireVendorOption) {
    setForm((current) => ({
      ...current,
      sourceChainId: vendor.chainId,
      sourceVendorId: vendor.id
    }));
    resetLookup();
  }

  function toggleChain(chainId: string) {
    setForm((current) => {
      const chainIds = current.chainIds.includes(chainId)
        ? current.chainIds.filter((id) => id !== chainId)
        : [...current.chainIds, chainId];
      return {
        ...current,
        chainIds,
        sourceChainId: chainIds[0] ?? ""
      };
    });
    resetLookup();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowedTargetRoles.includes(form.targetRole)) {
      setError("This New Hire target role is not available for your workspace.");
      return;
    }
    if (!isPhoneValid) {
      setError("Phone number must be 11 digits and start with 010, 011, 012, or 015.");
      return;
    }
    if (!isNationalIdValid) {
      setError("National ID must be exactly 14 digits.");
      return;
    }
    if (isBranchTarget && !form.sourceVendorId) {
      setError("Select the Chain and Branch before submitting New Hire.");
      return;
    }
    if (isAreaManagerTarget && !form.chainIds.length) {
      setError("Select at least one Chain before creating an Area Manager.");
      return;
    }
    if (!lookupResponse) {
      setError("Wait for candidate lookup before submitting.");
      return;
    }
    if (lookupStatus === "REHIRE_AVAILABLE" && !selectedRehireUserId) {
      setError("Select the previous Picker before submitting this Rehire.");
      return;
    }
    if (blockingCandidate) {
      setError(blockingCandidate.reason ?? "This candidate cannot be hired.");
      return;
    }
    if (lookupStatus === "CLEAR" && !form.nameEn.trim()) {
      setError("English name is required for a new user.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const created = await requestsApi.createNewHire({
          targetRole: form.targetRole,
          sourceVendorId: isBranchTarget ? form.sourceVendorId : undefined,
          sourceChainId: isAreaManagerTarget
            ? form.chainIds[0]
            : form.sourceChainId || selectedVendor?.chainId || undefined,
          chainIds: isAreaManagerTarget ? form.chainIds : undefined,
          rehireUserId:
            lookupStatus === "REHIRE_AVAILABLE"
              ? selectedRehireUserId || undefined
              : undefined,
          nameEn: lookupStatus === "CLEAR" ? form.nameEn || undefined : undefined,
          nameAr: lookupStatus === "CLEAR" ? form.nameAr || undefined : undefined,
          phoneNumber: form.phoneNumber,
          nationalId: form.nationalId,
          dateOfBirth:
            lookupStatus === "CLEAR" ? form.dateOfBirth || undefined : undefined,
          gender: lookupStatus === "CLEAR" ? form.gender : undefined,
          address: lookupStatus === "CLEAR" ? form.address || undefined : undefined,
          notes: form.notes || undefined
        });
        onCreated(created);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to submit New Hire request."
        );
      }
    });
  }

  return (
    <form
      className="grid min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
      onSubmit={submit}
    >
      {error ? <ErrorState message={error} /> : null}

      {!lockTargetRole ? (
        <NewHireFormSection
          description="Choose only the role this workspace can submit."
          title="Target role"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {allowedTargetRoles.map((role) => (
              <button
                className={cn(
                  "min-h-12 rounded-xl border p-3 text-left text-sm font-semibold transition-colors",
                  form.targetRole === role
                    ? "border-orange-300 bg-orange-50 text-orange-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
                )}
                key={role}
                onClick={() => updateTargetRole(role)}
                type="button"
              >
                {formatEnum(role)}
              </button>
            ))}
          </div>
        </NewHireFormSection>
      ) : null}

      <NewHireFormSection
        description={
          branchLocked
            ? "The Branch is locked from the current workspace."
            : isAreaManagerTarget
              ? "Area Managers are assigned directly to one or more Chains."
              : "Select a Chain first, then choose a Branch from the scoped search."
        }
        title="Operational context"
      >
        {branchLocked ? (
          <SelectedContextCard
            loading={isLoadingVendors}
            selectedChain={selectedVendor?.chain ?? selectedChain ?? null}
            selectedVendor={selectedVendor ?? null}
          />
        ) : isAreaManagerTarget ? (
          <div className="grid gap-3">
            <Field label="Chain search">
              <Input
                className="h-11 rounded-xl bg-white"
                disabled={isLoadingVendors}
                onChange={(event) => setChainQuery(event.target.value)}
                placeholder="Search Chain name or code"
                value={chainQuery}
              />
            </Field>
            <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chainSearchResults.map((chain) => (
                <button
                  className={cn(
                    "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                    form.chainIds.includes(chain.id)
                      ? "border-orange-300 bg-orange-50 text-orange-950"
                      : "border-slate-200 text-slate-700 hover:border-orange-200"
                  )}
                  key={chain.id}
                  onClick={() => toggleChain(chain.id)}
                  type="button"
                >
                  <span className="block font-semibold">{chain.chainName}</span>
                  <span className="block text-xs text-slate-500">
                    {chain.chainCode}
                  </span>
                </button>
              ))}
              {!chainSearchResults.length ? (
                <EmptyState message="No Chain matches this search." compact />
              ) : null}
            </div>
            {selectedChains.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedChains.map((chain) => (
                  <Badge key={chain.id} variant="outline">
                    {chain.chainName}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chain search">
                <Input
                  className="h-11 rounded-xl bg-white"
                  disabled={isLoadingVendors}
                  onChange={(event) => setChainQuery(event.target.value)}
                  placeholder="Search Chain name or code"
                  value={chainQuery}
                />
              </Field>
              <Field label="Branch search">
                <Input
                  className="h-11 rounded-xl bg-white"
                  disabled={!form.sourceChainId || isLoadingVendors}
                  onChange={(event) => setBranchQuery(event.target.value)}
                  placeholder="Search Branch name or code"
                  value={branchQuery}
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chainSearchResults.map((chain) => (
                  <button
                    className={cn(
                      "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                      form.sourceChainId === chain.id
                        ? "border-orange-300 bg-orange-50 text-orange-950"
                        : "border-slate-200 text-slate-700 hover:border-orange-200"
                    )}
                    key={chain.id}
                    onClick={() => updateSourceChain(chain.id)}
                    type="button"
                  >
                    <span className="block font-semibold">{chain.chainName}</span>
                    <span className="block text-xs text-slate-500">
                      {chain.chainCode}
                    </span>
                  </button>
                ))}
                {!chainSearchResults.length ? (
                  <EmptyState message="No Chain matches this search." compact />
                ) : null}
              </div>
              <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {form.sourceChainId ? (
                  filteredVendors.slice(0, 12).map((vendor) => (
                    <button
                      className={cn(
                        "min-h-12 rounded-xl border bg-white p-3 text-left text-sm transition-colors",
                        form.sourceVendorId === vendor.id
                          ? "border-orange-300 bg-orange-50 text-orange-950"
                          : "border-slate-200 text-slate-700 hover:border-orange-200"
                      )}
                      key={vendor.id}
                      onClick={() => selectBranch(vendor)}
                      type="button"
                    >
                      <span className="block font-semibold">{vendor.vendorName}</span>
                      <span className="block text-xs text-slate-500">
                        {vendor.vendorCode} / {vendor.chain.chainName}
                      </span>
                    </button>
                  ))
                ) : (
                  <EmptyState message="Select a Chain to load Branches." compact />
                )}
                {form.sourceChainId && !filteredVendors.length ? (
                  <EmptyState message="No Branch matches this Chain/search." compact />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </NewHireFormSection>

      <NewHireFormSection
        description="Lookup starts only after a valid Egyptian phone number or National ID is entered."
        title="Candidate identity"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              maxLength={11}
              onChange={(event) =>
                updateIdentityField("phoneNumber", event.target.value)
              }
              placeholder="01012345678"
              required
              value={form.phoneNumber}
            />
          </Field>
          <Field label="National ID">
            <Input
              className="h-11 rounded-xl"
              inputMode="numeric"
              maxLength={14}
              onChange={(event) =>
                updateIdentityField("nationalId", event.target.value)
              }
              placeholder="14 digits"
              required
              value={form.nationalId}
            />
          </Field>
        </div>
        <div className="grid gap-1 text-xs text-slate-500">
          {form.phoneNumber && !isPhoneValid ? (
            <span>Phone must be 11 digits and start with 010, 011, 012, or 015.</span>
          ) : null}
          {form.nationalId && !isNationalIdValid ? (
            <span>National ID must be exactly 14 digits.</span>
          ) : null}
          {!lookupContextReady ? (
            <span>Select the operational context before lookup can run.</span>
          ) : null}
        </div>
      </NewHireFormSection>

      {lookupState === "checking" ? (
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600 sm:px-5">
          Checking existing user records...
        </div>
      ) : null}

      {lookupStatus && lookupStatus !== "CLEAR" ? (
        <NewHireLookupResultCard
          candidate={blockingCandidate ?? rehireCandidate ?? lookupCandidates[0]}
          status={lookupStatus}
        />
      ) : null}

      {canShowCandidateForm ? (
        <>
          <NewHireFormSection description="Core profile fields for the requested user." title="Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name English">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("nameEn", event.target.value)}
                  required
                  value={form.nameEn}
                />
              </Field>
              <Field label="Name Arabic">
                <Input
                  className="h-11 rounded-xl"
                  onChange={(event) => updateField("nameAr", event.target.value)}
                  value={form.nameAr}
                />
              </Field>
            </div>
          </NewHireFormSection>
          <NewHireFormSection description="Optional personal fields used by the operational profile." title="Personal details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date of birth">
                <DatePicker
                  onChange={(value) => updateField("dateOfBirth", value)}
                  placeholder="Select birth date"
                  startYear={2000}
                  value={form.dateOfBirth}
                />
              </Field>
              <Field label="Gender">
                <Select
                  aria-label="Gender"
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  onChange={(event) => updateField("gender", event.target.value)}
                  value={form.gender}
                >
                  <option value="UNSPECIFIED">Unspecified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </Field>
            </div>
          </NewHireFormSection>
          <NewHireFormSection description="Contact location and operational notes." title="Contact and notes">
            <Field label="Address">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => updateField("address", event.target.value)}
                value={form.address}
              />
            </Field>
            <Field label="Notes">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => updateField("notes", event.target.value)}
                value={form.notes}
              />
            </Field>
          </NewHireFormSection>
        </>
      ) : lookupStatus === "REHIRE_AVAILABLE" ? (
        <NewHireFormSection
          description="Previous safe profile data is read-only for Rehire submission."
          title="Previous Picker"
        >
          <PreviousPickerCard candidate={rehireCandidate} />
          <Field label="Notes">
            <Input
              className="h-11 rounded-xl"
              onChange={(event) => updateField("notes", event.target.value)}
              value={form.notes}
            />
          </Field>
        </NewHireFormSection>
      ) : null}

      <div className="flex justify-end bg-slate-50/70 px-4 py-4 sm:px-5">
        <Button
          className="min-h-11 rounded-xl bg-orange-600 hover:bg-orange-700"
          disabled={!canSubmit}
          type="submit"
        >
          {isPending ? "Submitting..." : getNewHireSubmitLabel(form.targetRole)}
        </Button>
      </div>
    </form>
  );
}
