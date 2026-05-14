"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Store,
  UserCog,
  UserPlus,
  Users,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode
} from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalUserProfileModal } from "@/components/users/operational-user-profile-modal";
import {
  NewHireRequestForm,
  ResignationRequestForm
} from "@/components/requests/request-components";
import {
  adminOrganizationApi,
  type AdminOrganizationBranchDetail,
  type AdminOrganizationResponse,
  type OrganizationBranchSummary,
  type OrganizationChainSummary
} from "@/lib/api/admin-organization";
import { organizationApi } from "@/lib/api/organization";
import { requestsApi, type NewHireTargetRole } from "@/lib/api/requests";
import { usersApi } from "@/lib/api/users";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type AddMode = "chain" | "vendor" | null;
type AssignMode = "picker" | "champ" | "areaManager" | null;
type BranchNewHireTargetRole = Extract<NewHireTargetRole, "PICKER" | "CHAMP">;
type PickerAction =
  | { type: "transfer"; picker: SafePicker }
  | { type: "resignation"; picker: SafePicker }
  | null;

type SafePicker = AdminOrganizationBranchDetail["pickers"][number]["picker"];
type BranchUser = SafePicker;

export function OrganizationControlCenter() {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LoadState<AdminOrganizationResponse>>({
    status: "loading"
  });
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState("");
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [carouselState, setCarouselState] = useState({
    canScrollLeft: false,
    canScrollRight: false
  });
  const [areaManagerChain, setAreaManagerChain] =
    useState<OrganizationChainSummary | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  async function loadOrganization(preferredChainId = selectedChainId) {
    setState({ status: "loading" });
    try {
      const data = await adminOrganizationApi.get();
      const nextSelected =
        preferredChainId && data.chains.some((chain) => chain.id === preferredChainId)
          ? preferredChainId
          : data.chains[0]?.id ?? null;
      setSelectedChainId(nextSelected);
      setState({ status: "ready", data });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load organization."
      });
    }
  }

  useEffect(() => {
    void loadOrganization(null);
  }, []);

  const selectedChain = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return (
      state.data.chains.find((chain) => chain.id === selectedChainId) ??
      state.data.chains[0] ??
      null
    );
  }, [selectedChainId, state]);

  const visibleBranches = useMemo(() => {
    if (!selectedChain) {
      return [];
    }

    const query = branchQuery.trim().toLowerCase();
    if (!query) {
      return selectedChain.branches;
    }

    return selectedChain.branches.filter((branch) =>
      [
        branch.vendorName,
        branch.vendorCode,
        branch.currentChamp?.nameEn,
        branch.currentChamp?.phoneNumber
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [branchQuery, selectedChain]);

  function openAdd(mode: Exclude<AddMode, null>) {
    setAddMode(mode);
    setAddOpen(true);
    setAddMenuOpen(false);
  }

  function updateCarouselState() {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
    setCarouselState({
      canScrollLeft: carousel.scrollLeft > 8,
      canScrollRight: carousel.scrollLeft < maxScrollLeft - 8
    });
  }

  function scrollCarousel(direction: "left" | "right") {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    carousel.scrollBy({
      left: direction === "right" ? carousel.clientWidth : -carousel.clientWidth,
      behavior: "smooth"
    });
    window.setTimeout(updateCarouselState, 360);
  }

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    updateCarouselState();
    window.addEventListener("resize", updateCarouselState);
    return () => window.removeEventListener("resize", updateCarouselState);
  }, [state]);

  if (state.status === "loading") {
    return <PanelState icon={Loader2} label="Loading organization" spin />;
  }

  if (state.status === "error") {
    return (
      <PanelState
        action={<Button onClick={() => void loadOrganization()}>Retry</Button>}
        icon={X}
        label={state.message}
      />
    );
  }

  return (
    <div className="grid gap-5 overflow-x-hidden">
      <div className="flex justify-end">
        <div className="relative">
          <Button
            className="h-11 rounded-xl bg-orange-600 px-4 text-white hover:bg-orange-700"
            onClick={() => setAddMenuOpen((value) => !value)}
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          {addMenuOpen ? (
            <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <MenuButton
                icon={<GitBranch className="h-4 w-4" />}
                label="Add Chain"
                onClick={() => openAdd("chain")}
              />
              <MenuButton
                icon={<Store className="h-4 w-4" />}
                label="Add Vendor / Branch"
                onClick={() => openAdd("vendor")}
              />
            </div>
          ) : null}
        </div>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Chains</p>
            <p className="text-xs text-slate-500">Select one Chain to inspect its Branches.</p>
          </div>
          <div className="flex gap-2">
            <IconButton
              label="Scroll chains left"
              disabled={!carouselState.canScrollLeft}
              onClick={() => scrollCarousel("left")}
            >
              <ArrowLeft className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Scroll chains right"
              disabled={!carouselState.canScrollRight}
              onClick={() => scrollCarousel("right")}
            >
              <ArrowRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        {state.data.chains.length ? (
          <div className="relative min-w-0 overflow-hidden">
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200",
                carouselState.canScrollLeft ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200",
                carouselState.canScrollRight ? "opacity-100" : "opacity-0"
              )}
            />
            <div
              className="flex min-w-0 snap-x snap-mandatory touch-pan-x gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
              onScroll={updateCarouselState}
              ref={carouselRef}
            >
              {state.data.chains.map((chain) => (
                <ChainCard
                  chain={chain}
                  key={chain.id}
                  onSelect={() => {
                    setSelectedChainId(chain.id);
                    setBranchQuery("");
                  }}
                  selected={chain.id === selectedChain?.id}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyBlock
            icon={<GitBranch className="h-5 w-5" />}
            message="Create a Chain to start building the operating hierarchy."
          />
        )}
      </section>

      {selectedChain ? (
        <section className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                Selected Chain
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {selectedChain.chainName}
              </h2>
              <p className="text-sm text-slate-500">{selectedChain.chainCode}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric label="Branches" value={selectedChain.branchCount} />
              <MiniMetric label="Pickers" value={selectedChain.activePickerCount} />
              <MiniMetric label="Requests" value={selectedChain.requestCount} />
              <MiniMetric
                label="Area Manager"
                value={selectedChain.currentAreaManager?.nameEn ?? "Unassigned"}
                wide
              />
            </div>
          </div>
          <div>
            <Button
              className="h-11 rounded-xl border-slate-200"
              onClick={() => setAreaManagerChain(selectedChain)}
              type="button"
              variant="outline"
            >
              <UserCog className="mr-2 h-4 w-4 text-orange-600" />
              Assign Area Manager
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="h-11 rounded-xl border-slate-200 pl-9"
                onChange={(event) => setBranchQuery(event.target.value)}
                placeholder="Search Branch or Champ"
                value={branchQuery}
              />
            </div>
            <Button
              className="h-11 rounded-xl border-slate-200"
              onClick={() => openAdd("vendor")}
              type="button"
              variant="outline"
            >
              <Store className="mr-2 h-4 w-4 text-orange-600" />
              Add Branch
            </Button>
          </div>

          <BranchTable
            branches={visibleBranches}
            onOpen={(branch) => setSelectedBranchId(branch.id)}
          />
        </section>
      ) : null}

      {addOpen && addMode ? (
        <AddResourceModal
          chains={state.data.chains}
          mode={addMode}
          onClose={() => setAddOpen(false)}
          onSaved={(chainId) => {
            setAddOpen(false);
            void loadOrganization(chainId);
          }}
          selectedChainId={selectedChain?.id ?? ""}
        />
      ) : null}

      {selectedBranchId ? (
        <BranchDetailSheet
          allChains={state.data.chains}
          branchId={selectedBranchId}
          onClose={() => setSelectedBranchId(null)}
          onChanged={() => void loadOrganization(selectedChain?.id ?? null)}
        />
      ) : null}

      {areaManagerChain ? (
        <AreaManagerModal
          chain={areaManagerChain}
          onClose={() => setAreaManagerChain(null)}
          onSaved={() => {
            const chainId = areaManagerChain.id;
            setAreaManagerChain(null);
            void loadOrganization(chainId);
          }}
        />
      ) : null}
    </div>
  );
}

function ChainCard({
  chain,
  onSelect,
  selected
}: {
  chain: OrganizationChainSummary;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      data-chain-card="true"
      className={cn(
        "min-h-[164px] shrink-0 basis-[min(82vw,280px)] snap-start rounded-[24px] border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:basis-[calc((100%_-_0.75rem)/2)] lg:basis-[calc((100%_-_2.25rem)/4)]",
        selected
          ? "border-orange-300 bg-orange-50 shadow-sm ring-2 ring-orange-100"
          : "border-slate-200 bg-slate-50/70 hover:border-orange-200"
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
          <Building2 className="h-5 w-5" />
        </div>
        <StatusBadge status={chain.status} />
      </div>
      <h3 className="mt-4 line-clamp-2 text-lg font-semibold text-slate-950">
        {chain.chainName}
      </h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {chain.chainCode}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <CardStat label="Branches" value={chain.branchCount} />
        <CardStat label="Pickers" value={chain.activePickerCount} />
        <CardStat label="Requests" value={chain.requestCount} />
      </div>
    </button>
  );
}

function BranchTable({
  branches,
  onOpen
}: {
  branches: OrganizationBranchSummary[];
  onOpen: (branch: OrganizationBranchSummary) => void;
}) {
  if (!branches.length) {
    return (
      <EmptyBlock
        icon={<Store className="h-5 w-5" />}
        message="No Branches match the selected Chain."
      />
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-[38%] px-3 py-3 sm:px-4">Branch</th>
            <th className="w-[18%] px-3 py-3 sm:px-4">Pickers</th>
            <th className="hidden w-[18%] px-3 py-3 sm:table-cell sm:px-4">Requests</th>
            <th className="w-[28%] px-3 py-3 sm:px-4">Champ</th>
            <th className="hidden w-[16%] px-3 py-3 lg:table-cell lg:px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr
              className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-orange-50/40"
              key={branch.id}
              onClick={() => onOpen(branch)}
              tabIndex={0}
            >
              <td className="px-3 py-3 sm:px-4">
                <p className="truncate font-semibold text-slate-950">{branch.vendorName}</p>
                <p className="truncate text-xs text-slate-500">{branch.vendorCode}</p>
              </td>
              <td className="px-3 py-3 sm:px-4">{branch.activePickerCount}</td>
              <td className="hidden px-3 py-3 sm:table-cell sm:px-4">{branch.requestCount}</td>
              <td className="px-3 py-3 sm:px-4">
                {branch.currentChamp ? (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {branch.currentChamp.nameEn}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {branch.currentChamp.phoneNumber}
                    </p>
                  </div>
                ) : (
                  <Badge variant="muted">Unassigned</Badge>
                )}
              </td>
              <td className="hidden px-3 py-3 lg:table-cell lg:px-4">
                <StatusBadge status={branch.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddResourceModal({
  chains,
  mode,
  onClose,
  onSaved,
  selectedChainId
}: {
  chains: OrganizationChainSummary[];
  mode: Exclude<AddMode, null>;
  onClose: () => void;
  onSaved: (chainId?: string) => void;
  selectedChainId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [chainName, setChainName] = useState("");
  const [chainCode, setChainCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [chainId, setChainId] = useState(selectedChainId);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (mode === "chain") {
          const created = await organizationApi.createChain({
            chainName,
            chainCode: chainCode.toUpperCase(),
            status
          });
          onSaved(created.id);
          return;
        }

        const created = await organizationApi.createVendor({
          vendorName,
          vendorCode: vendorCode.toUpperCase(),
          chainId,
          status
        });
        onSaved(created.chainId);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to save record."
        );
      }
    });
  }

  return (
    <ModalFrame
      onClose={onClose}
      title={mode === "chain" ? "Add Chain" : "Add Vendor / Branch"}
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error ? <InlineError message={error} /> : null}
        {mode === "chain" ? (
          <>
            <FormField label="Chain name">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setChainName(event.target.value)}
                required
                value={chainName}
              />
            </FormField>
            <FormField label="Chain code">
              <Input
                className="h-11 rounded-xl uppercase"
                onChange={(event) => setChainCode(event.target.value.toUpperCase())}
                required
                value={chainCode}
              />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Branch name">
              <Input
                className="h-11 rounded-xl"
                onChange={(event) => setVendorName(event.target.value)}
                required
                value={vendorName}
              />
            </FormField>
            <FormField label="Branch code">
              <Input
                className="h-11 rounded-xl uppercase"
                onChange={(event) => setVendorCode(event.target.value.toUpperCase())}
                required
                value={vendorCode}
              />
            </FormField>
            <FormField label="Chain">
              <select
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                onChange={(event) => setChainId(event.target.value)}
                required
                value={chainId}
              >
                <option value="">Select Chain</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.chainName}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}
        <FormField label="Status">
          <select
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")}
            required
            value={status}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </FormField>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-orange-600 text-white hover:bg-orange-700"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

function BranchDetailSheet({
  allChains,
  branchId,
  onChanged,
  onClose
}: {
  allChains: OrganizationChainSummary[];
  branchId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState<AdminOrganizationBranchDetail>>({
    status: "loading"
  });
  const [editing, setEditing] = useState(false);
  const [assignMode, setAssignMode] = useState<AssignMode>(null);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [pickerAction, setPickerAction] = useState<PickerAction>(null);
  const [newHireMenuOpen, setNewHireMenuOpen] = useState(false);
  const [newHireTargetRole, setNewHireTargetRole] =
    useState<BranchNewHireTargetRole | null>(null);
  const [selectedUser, setSelectedUser] = useState<BranchUser | null>(null);

  async function loadBranch() {
    setState({ status: "loading" });
    try {
      setState({
        status: "ready",
        data: await adminOrganizationApi.getBranch(branchId)
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to load Branch details."
      });
    }
  }

  useEffect(() => {
    void loadBranch();
  }, [branchId]);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/35 p-2 sm:p-4"
      role="dialog"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Branch
            </p>
            <h2 className="truncate text-xl font-semibold text-slate-950">
              {state.status === "ready" ? state.data.branch.vendorName : "Branch"}
            </h2>
            <p className="truncate text-sm text-slate-500">
              {state.status === "ready" ? state.data.chain.chainName : "Loading"}
            </p>
          </div>
          <IconButton label="Close Branch" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          {state.status === "loading" ? (
            <PanelState icon={Loader2} label="Loading Branch" spin />
          ) : state.status === "error" ? (
            <PanelState
              action={<Button onClick={() => void loadBranch()}>Retry</Button>}
              icon={X}
              label={state.message}
            />
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">
                    {state.data.branch.vendorName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {state.data.branch.vendorCode} · {state.data.chain.chainName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Button
                      className="rounded-xl bg-orange-600 text-white hover:bg-orange-700"
                      onClick={() => {
                        setNewHireMenuOpen((value) => !value);
                        setAssignMenuOpen(false);
                      }}
                      type="button"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      New Hire
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                    {newHireMenuOpen ? (
                      <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        <MenuButton
                          icon={<Users className="h-4 w-4" />}
                          label="Picker"
                          onClick={() => {
                            setNewHireTargetRole("PICKER");
                            setNewHireMenuOpen(false);
                          }}
                        />
                        <MenuButton
                          icon={<UserCog className="h-4 w-4" />}
                          label="Champ"
                          onClick={() => {
                            setNewHireTargetRole("CHAMP");
                            setNewHireMenuOpen(false);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Button
                      className="rounded-xl"
                      onClick={() => {
                        setAssignMenuOpen((value) => !value);
                        setNewHireMenuOpen(false);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Assign
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                    {assignMenuOpen ? (
                      <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        <MenuButton
                          icon={<Users className="h-4 w-4" />}
                          label="Transfer Picker"
                          onClick={() => {
                            setAssignMode("picker");
                            setAssignMenuOpen(false);
                          }}
                        />
                        <MenuButton
                          icon={<UserCog className="h-4 w-4" />}
                          label="Champ"
                          onClick={() => {
                            setAssignMode("champ");
                            setAssignMenuOpen(false);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    className="rounded-xl"
                    onClick={() => setEditing((value) => !value)}
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                </div>
              </div>

              {editing ? (
                <BranchEditForm
                  branch={state.data.branch}
                  chains={allChains}
                  onSaved={() => {
                    setEditing(false);
                    onChanged();
                    void loadBranch();
                  }}
                />
              ) : null}

              <div className="grid gap-4">
                <PeopleTable
                  actionLabel="Actions"
                  emptyLabel="No active Champ assignment."
                  items={state.data.currentChamp ? [state.data.currentChamp] : []}
                  kind="champ"
                  onChampAssign={() => setAssignMode("champ")}
                  onOpenUser={setSelectedUser}
                />
                <PeopleTable
                  actionLabel="Actions"
                  emptyLabel="No active Pickers in this Branch."
                  items={state.data.pickers}
                  kind="picker"
                  onOpenUser={setSelectedUser}
                  onPickerAction={setPickerAction}
                  paginate
                />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-950">Recent requests</h3>
                <div className="mt-3 grid gap-2">
                  {state.data.requests.length ? (
                    state.data.requests.map((request) => (
                      <a
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"
                        href={request.route}
                        key={request.id}
                      >
                        <span>
                          <span className="font-medium text-slate-950">
                            {formatEnum(request.type)}
                          </span>
                          <span className="ml-2 text-slate-500">
                            {request.targetUser?.nameEn ?? "No target user"}
                          </span>
                        </span>
                        <Badge variant="muted">{formatEnum(request.status)}</Badge>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No recent requests.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {state.status === "ready" && newHireTargetRole ? (
        <NewHireModal
          branch={state.data.branch}
          chain={state.data.chain}
          onClose={() => setNewHireTargetRole(null)}
          onSaved={() => {
            setNewHireTargetRole(null);
            void loadBranch();
            onChanged();
          }}
          targetRole={newHireTargetRole}
        />
      ) : null}

      {state.status === "ready" && assignMode ? (
        <AssignModal
          branch={state.data.branch}
          chain={state.data.chain}
          mode={assignMode}
          onClose={() => setAssignMode(null)}
          onSaved={() => {
            setAssignMode(null);
            void loadBranch();
            onChanged();
          }}
        />
      ) : null}

      {state.status === "ready" && pickerAction ? (
        <PickerActionModal
          action={pickerAction}
          allBranches={allChains.flatMap((chain) => chain.branches)}
          sourceBranch={state.data.branch}
          onClose={() => setPickerAction(null)}
          onSaved={() => {
            setPickerAction(null);
            void loadBranch();
            onChanged();
          }}
        />
      ) : null}

      {selectedUser ? (
        <OperationalUserProfileModal
          actions={{
            onTransfer: (user) => {
              setPickerAction({ type: "transfer", picker: user });
              setSelectedUser(null);
            },
            onResignation: (user) => {
              setPickerAction({ type: "resignation", picker: user });
              setSelectedUser(null);
            }
          }}
          onClose={() => setSelectedUser(null)}
          onUpdated={() => {
            void loadBranch();
            onChanged();
          }}
          userId={selectedUser.id}
        />
      ) : null}
    </div>
  );
}

function BranchEditForm({
  branch,
  chains,
  onSaved
}: {
  branch: OrganizationBranchSummary;
  chains: OrganizationChainSummary[];
  onSaved: () => void;
}) {
  const [vendorName, setVendorName] = useState(branch.vendorName);
  const [vendorCode, setVendorCode] = useState(branch.vendorCode);
  const [chainId, setChainId] = useState(branch.chainId);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(branch.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await organizationApi.updateVendor(branch.id, {
          vendorName,
          vendorCode: vendorCode.toUpperCase(),
          chainId,
          status
        });
        onSaved();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to update Branch."
        );
      }
    });
  }

  return (
    <form
      className="grid gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 md:grid-cols-5"
      onSubmit={onSubmit}
    >
      {error ? <div className="md:col-span-5"><InlineError message={error} /></div> : null}
      <Input
        className="h-11 rounded-xl md:col-span-2"
        onChange={(event) => setVendorName(event.target.value)}
        required
        value={vendorName}
      />
      <Input
        className="h-11 rounded-xl uppercase"
        onChange={(event) => setVendorCode(event.target.value.toUpperCase())}
        required
        value={vendorCode}
      />
      <select
        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
        onChange={(event) => setChainId(event.target.value)}
        required
        value={chainId}
      >
        {chains.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.chainName}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <select
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")}
          required
          value={status}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <Button disabled={isPending} type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

function PeopleTable({
  actionLabel,
  emptyLabel,
  items,
  kind,
  onChampAssign,
  onOpenUser,
  onPickerAction,
  paginate
}: {
  actionLabel: string;
  emptyLabel: string;
  items: Array<{ assignment: { id: string; startDate: string }; picker?: SafePicker; champ?: SafePicker }>;
  kind: "picker" | "champ";
  onChampAssign?: () => void;
  onOpenUser: (user: BranchUser) => void;
  onPickerAction?: (action: PickerAction) => void;
  paginate?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = paginate
    ? items.slice((page - 1) * pageSize, page * pageSize)
    : items;

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-950">
          {kind === "picker" ? "Pickers" : "Champ"}
        </h3>
        <Badge variant="muted">{actionLabel}</Badge>
      </div>
      {items.length ? (
        <>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="w-[42%] py-2 pr-2">User</th>
                <th className="hidden w-[28%] py-2 pr-2 sm:table-cell">Phone</th>
                <th className="w-[20%] py-2 pr-2">Since</th>
                <th className="w-[14%] py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const user = item.picker ?? item.champ;
                if (!user) {
                  return null;
                }
                return (
                  <tr
                    className="cursor-pointer border-t border-slate-100 hover:bg-orange-50/40"
                    key={item.assignment.id}
                    onClick={() => onOpenUser(user)}
                    tabIndex={0}
                  >
                    <td className="py-3 pr-2">
                      <p className="truncate font-medium text-slate-950">{user.nameEn}</p>
                      <p className="truncate text-xs text-slate-500">{formatEnum(user.role)}</p>
                      <p className="truncate text-xs text-slate-500 sm:hidden">
                        {user.phoneNumber}
                      </p>
                    </td>
                    <td className="hidden py-3 pr-2 text-slate-600 sm:table-cell">
                      <span className="truncate">{user.phoneNumber}</span>
                    </td>
                    <td className="py-3 pr-2 text-slate-500">
                      {formatDate(item.assignment.startDate)}
                    </td>
                    <td className="py-3 text-right" onClick={(event) => event.stopPropagation()}>
                      {kind === "picker" ? (
                        <RowActionMenu
                          onResignation={() =>
                            onPickerAction?.({ type: "resignation", picker: user })
                          }
                          onTransfer={() =>
                            onPickerAction?.({ type: "transfer", picker: user })
                          }
                        />
                      ) : (
                        <ChampActionMenu onAssign={onChampAssign} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {paginate && totalPages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Prev
                </Button>
                <Button
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

function AssignModal({
  branch,
  chain,
  mode,
  onClose,
  onSaved
}: {
  branch: OrganizationBranchSummary;
  chain: AdminOrganizationBranchDetail["chain"];
  mode: Exclude<AssignMode, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role: UserRole =
    mode === "picker" ? "PICKER" : mode === "champ" ? "CHAMP" : "AREA_MANAGER";
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSearch = query.trim().length >= 3;

  useEffect(() => {
    setSelectedUser(null);
    if (!canSearch) {
      setUsers([]);
      return;
    }

    usersApi
      .list({ page: 1, pageSize: 100, role, status: "ACTIVE", q: query })
      .then((response) => setUsers(response.items))
      .catch((caughtError) =>
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to load users."
        )
      );
  }, [canSearch, query, role]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "picker") {
          await adminOrganizationApi.assignPicker(branch.id, {
            pickerId: selectedUser?.id ?? ""
          });
        } else if (mode === "champ") {
          await adminOrganizationApi.replaceChamp(branch.id, {
            champId: selectedUser?.id ?? ""
          });
        } else {
          await adminOrganizationApi.replaceAreaManager(chain.id, {
            areaManagerId: selectedUser?.id ?? ""
          });
        }
        onSaved();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to complete assignment."
        );
      }
    });
  }

  return (
    <ModalFrame
      onClose={onClose}
      title={
        mode === "picker"
          ? "Transfer Picker"
          : mode === "champ"
            ? "Assign Champ"
            : "Assign Area Manager"
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error ? <InlineError message={error} /> : null}
        <FormField label={`Search ${mode === "picker" ? "Picker" : "Champ"}`}>
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type at least 3 letters or numbers"
            value={query}
          />
        </FormField>
        <UserSearchResults
          canSearch={canSearch}
          onSelect={setSelectedUser}
          selectedUser={selectedUser}
          users={users}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending || !selectedUser} type="submit">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "picker" ? "Create Transfer" : "Save"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

function AreaManagerModal({
  chain,
  onClose,
  onSaved
}: {
  chain: OrganizationChainSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    usersApi
      .list({
        page: 1,
        pageSize: 100,
        role: "AREA_MANAGER",
        status: "ACTIVE",
        q: query
      })
      .then((response) => setUsers(response.items))
      .catch((caughtError) =>
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to load users."
        )
      );
  }, [query]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await adminOrganizationApi.replaceAreaManager(chain.id, {
          areaManagerId: selectedUserId
        });
        onSaved();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to assign Area Manager."
        );
      }
    });
  }

  return (
    <ModalFrame onClose={onClose} title="Assign Area Manager">
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error ? <InlineError message={error} /> : null}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-950">{chain.chainName}</p>
          <p className="text-slate-500">{chain.chainCode}</p>
        </div>
        <FormField label="Search Area Manager">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or phone"
            value={query}
          />
        </FormField>
        <FormField label="Area Manager">
          <select
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            onChange={(event) => setSelectedUserId(event.target.value)}
            required
            value={selectedUserId}
          >
            <option value="">Select Area Manager</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nameEn} · {user.phoneNumber}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending || !selectedUserId} type="submit">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

function NewHireModal({
  branch,
  chain,
  onClose,
  onSaved,
  targetRole
}: {
  branch: OrganizationBranchSummary;
  chain: Pick<OrganizationChainSummary, "id" | "chainName" | "chainCode" | "status">;
  onClose: () => void;
  onSaved: () => void;
  targetRole: BranchNewHireTargetRole;
}) {
  const [isDirty, setIsDirty] = useState(false);

  function requestClose() {
    if (isDirty && !window.confirm("Discard the New Hire data you entered?")) {
      return;
    }

    onClose();
  }

  return (
    <ModalFrame onClose={requestClose} size="wide" title="New Hire request">
      <NewHireRequestForm
        fixedSourceVendorId={branch.id}
        initialTargetRole={targetRole}
        lockedBranchContext={{ vendor: branch, chain }}
        lockTargetRole
        onCreated={() => {
          onSaved();
        }}
        onDirtyChange={setIsDirty}
      />
    </ModalFrame>
  );
}

function PickerActionModal({
  action,
  allBranches,
  onClose,
  onSaved,
  sourceBranch
}: {
  action: Exclude<PickerAction, null>;
  allBranches: OrganizationBranchSummary[];
  onClose: () => void;
  onSaved: () => void;
  sourceBranch: OrganizationBranchSummary;
}) {
  const [destinationVendorId, setDestinationVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (action.type === "resignation") {
    return (
      <ModalFrame onClose={onClose} title="Resignation request">
        <ResignationRequestForm
          fixedSourceVendorId={sourceBranch.id}
          initialPicker={action.picker}
          onCreated={() => {
            onSaved();
          }}
        />
      </ModalFrame>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (action.type === "transfer") {
          await requestsApi.createTransfer({
            sourceVendorId: sourceBranch.id,
            destinationVendorId,
            targetUserId: action.picker.id,
            reason: reason || "Created from Admin Organization Control Center."
          });
        }
        onSaved();
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
    <ModalFrame onClose={onClose} title={`${formatEnum(action.type)} request`}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        {error ? <InlineError message={error} /> : null}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-950">{action.picker.nameEn}</p>
          <p className="text-slate-500">{action.picker.phoneNumber}</p>
        </div>
        {action.type === "transfer" ? (
          <FormField label="Destination Branch">
            <select
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
              onChange={(event) => setDestinationVendorId(event.target.value)}
              required
              value={destinationVendorId}
            >
              <option value="">Select Branch</option>
              {allBranches
                .filter((branch) => branch.id !== sourceBranch.id)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.vendorName} · {branch.chain.chainName}
                  </option>
                ))}
            </select>
          </FormField>
        ) : null}
        <FormField label="Reason">
          <Input
            className="h-11 rounded-xl"
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} type="submit">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}

function UserSearchResults({
  canSearch,
  onSelect,
  selectedUser,
  users
}: {
  canSearch: boolean;
  onSelect: (user: SafeUser) => void;
  selectedUser: SafeUser | null;
  users: SafeUser[];
}) {
  if (!canSearch) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Start typing at least 3 letters or numbers.
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No matching active users.
      </div>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 p-2">
      {users.map((user) => (
        <button
          className={cn(
            "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-orange-50",
            selectedUser?.id === user.id ? "bg-orange-50 ring-1 ring-orange-200" : ""
          )}
          key={user.id}
          onClick={() => onSelect(user)}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950">
              {user.nameEn}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {user.phoneNumber}
            </span>
          </span>
          <Badge variant={selectedUser?.id === user.id ? "default" : "muted"}>
            {selectedUser?.id === user.id ? "Selected" : formatEnum(user.role)}
          </Badge>
        </button>
      ))}
    </div>
  );
}

function ChampActionMenu({ onAssign }: { onAssign?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <IconButton label="Open Champ actions" onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl">
          <MenuButton label="Assign Champ" onClick={() => onAssign?.()} />
        </div>
      ) : null}
    </div>
  );
}

function RowActionMenu({
  onResignation,
  onTransfer
}: {
  onResignation: () => void;
  onTransfer: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <IconButton label="Open Picker actions" onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal className="h-4 w-4" />
      </IconButton>
      {open ? (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl">
          <MenuButton label="Transfer" onClick={onTransfer} />
          <MenuButton label="Resignation" onClick={onResignation} />
        </div>
      ) : null}
    </div>
  );
}

function ModalFrame({
  children,
  onClose,
  size = "default",
  title
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "wide";
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/35 p-0 sm:place-items-center sm:p-4">
      <div
        className={cn(
          "max-h-[92vh] w-full overflow-auto rounded-t-[28px] border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-[28px] sm:p-5",
          size === "wide" ? "sm:max-w-5xl xl:max-w-6xl" : "sm:max-w-lg"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <IconButton label={`Close ${title}`} onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function MenuButton({
  icon,
  label,
  onClick
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MiniMetric({
  label,
  value,
  wide
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50 p-3",
        wide ? "col-span-2 sm:col-span-1" : ""
      )}
    >
      <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/80 p-2">
      <p className="text-base font-semibold text-slate-950">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function EmptyBlock({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
      <div className="text-orange-600">{icon}</div>
      {message}
    </div>
  );
}

function PanelState({
  action,
  icon: Icon,
  label,
  spin
}: {
  action?: ReactNode;
  icon: typeof Loader2;
  label: string;
  spin?: boolean;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-[22px] border border-slate-200 bg-white p-6 text-center">
      <div>
        <Icon
          className={cn(
            "mx-auto h-7 w-7 text-orange-600",
            spin ? "animate-spin" : ""
          )}
        />
        <p className="mt-3 text-sm font-medium text-slate-700">{label}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
