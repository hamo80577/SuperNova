"use client";

import {
  ArrowRightLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  UserMinus,
  UserRound,
  Users
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { NewRequestSheet } from "@/components/requests/forms/new-request-sheet";
import {
  type InitialTransferPicker,
  type NewRequestDraft
} from "@/components/requests/shared/request-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import type { ResignationTargetRole } from "@/lib/api/requests";
import type { SafeUser, UserRole } from "@/lib/auth/types";
import { usersApi } from "@/lib/api/users";
import {
  type AssignmentSummary,
  type ChainSummary,
  type UserSummary,
  type VendorSummary,
  workspacesApi
} from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { OperationalUserProfileModal } from "./operational-user-profile-modal";

type UsersSectionId = "pickers" | "champs" | "management";

type UsersAreaState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "error"; error: string; data?: never }
  | { status: "ready"; data: UsersAreaData; error?: never };

type UsersAreaData = {
  pickers: UsersAreaItem[];
  champs: UsersAreaItem[];
  management: UsersAreaItem[];
};

type UsersAreaItem = {
  key: string;
  user: UserSummary | SafeUser;
  assignment?: AssignmentSummary | null;
  vendor?: VendorSummary | null;
  chain?: ChainSummary | null;
};

const managementRoles: UserRole[] = ["AREA_MANAGER", "ADMIN", "SUPER_ADMIN"];

export function UsersAreaPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [state, setState] = useState<UsersAreaState>({ status: "loading" });
  const [activeSection, setActiveSection] = useState<UsersSectionId>("pickers");
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState<NewRequestDraft | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function loadUsersArea() {
    if (!user) {
      return;
    }

    setState({ status: "loading" });
    setRequestError(null);
    try {
      setState({ status: "ready", data: await fetchUsersAreaData(user.role) });
    } catch (caughtError) {
      setState({
        status: "error",
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load Users area."
      });
    }
  }

  useEffect(() => {
    void loadUsersArea();
  }, [user?.role]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [searchParams]);

  const visibleSections = useMemo(
    () => getVisibleSections(user?.role),
    [user?.role]
  );
  const data = state.status === "ready" ? state.data : emptyUsersAreaData();

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      setActiveSection(visibleSections[0]?.id ?? "pickers");
    }
  }, [activeSection, visibleSections]);

  const activeItems = filterItems(data[activeSection], query);
  const activeSectionLabel =
    visibleSections.find((section) => section.id === activeSection)?.label ??
    getSectionLabel(activeSection, user?.role);
  const selectedItem =
    [...data.pickers, ...data.champs, ...data.management].find(
      (item) => item.user.id === selectedUserId
    ) ?? null;
  const selectedUser = selectedItem?.user ?? null;
  const allowedResignationRoles = getAllowedResignationTargetRoles(user?.role);

  function openResignation(target: UserSummary | SafeUser) {
    setRequestError(null);
    if (!isResignationTargetRole(target.role)) {
      return;
    }

    setRequestDraft({
      type: "RESIGNATION",
      targetRole: target.role,
      initialUser: {
        id: target.id,
        nameEn: target.nameEn,
        phoneNumber: target.phoneNumber,
        role: target.role
      }
    });
  }

  function openTransfer(target: UsersAreaItem) {
    setRequestError(null);

    if (target.user.role !== "PICKER") {
      setRequestError("Transfer is available only for Pickers.");
      return;
    }

    const activeAssignments = data.pickers.filter(
      (item) =>
        item.user.id === target.user.id && item.assignment?.status === "ACTIVE"
    );

    if (activeAssignments.length > 1) {
      setRequestError(
        "This Picker has multiple active Branch assignments in the current view. Resolve the assignment data before starting Transfer."
      );
      return;
    }

    setRequestDraft({
      type: "TRANSFER",
      initialPicker: toInitialTransferPicker(
        target.assignment ? target : activeAssignments[0] ?? target
      )
    });
  }

  function handleCreated() {
    setRequestDraft(null);
    void loadUsersArea();
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
              Assignment-scoped users
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
              Users
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Open profile cards and lifecycle requests from the users you are allowed to manage.
            </p>
          </div>
          <Button
            className="min-h-11 rounded-xl"
            onClick={() => void loadUsersArea()}
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {visibleSections.map((section) => (
              <button
                className={cn(
                  "min-h-11 rounded-xl border px-3 text-left text-sm font-semibold transition",
                  activeSection === section.id
                    ? "border-orange-300 bg-orange-50 text-orange-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200"
                )}
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                {section.label}
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {data[section.id].length}
                </span>
              </button>
            ))}
          </div>
          <label className="relative min-w-0 md:w-80">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-11 rounded-xl pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, Branch, Chain"
              value={query}
            />
          </label>
        </div>
      </section>

      {state.status === "loading" ? (
        <TableRowsSkeleton label="Loading Users" rows={6} />
      ) : requestError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {requestError}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      ) : (
        <UsersSection
          items={activeItems}
          onOpenProfile={setSelectedUserId}
          onOpenResignation={(target) => openResignation(target)}
          onOpenTransfer={openTransfer}
          sectionLabel={activeSectionLabel}
          viewerRole={user?.role}
        />
      )}

      {selectedUserId ? (
        <OperationalUserProfileModal
          actions={{
            onTransfer:
              selectedItem?.user.role === "PICKER"
                ? () => openTransfer(selectedItem)
                : undefined,
            onResignation:
              selectedUser &&
              isResignationTargetRole(selectedUser.role) &&
              allowedResignationRoles.includes(selectedUser.role)
                ? () => openResignation(selectedUser)
                : undefined
          }}
          onClose={() => setSelectedUserId(null)}
          onUpdated={() => void loadUsersArea()}
          userId={selectedUserId}
        />
      ) : null}

      {requestDraft ? (
        <NewRequestSheet
          draft={requestDraft}
          onClose={() => setRequestDraft(null)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}

function UsersSection({
  items,
  onOpenProfile,
  onOpenResignation,
  onOpenTransfer,
  sectionLabel,
  viewerRole
}: {
  items: UsersAreaItem[];
  onOpenProfile: (id: string) => void;
  onOpenResignation: (user: UserSummary | SafeUser) => void;
  onOpenTransfer: (item: UsersAreaItem) => void;
  sectionLabel: string;
  viewerRole?: UserRole;
}) {
  const allowedResignationRoles = getAllowedResignationTargetRoles(viewerRole);

  if (!items.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <Users className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">
          No {sectionLabel.toLowerCase()} are currently visible.
        </p>
        <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
          Users appear here only when active assignment data puts them inside your scope.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const canTransfer = item.user.role === "PICKER";
        const canResign =
          isResignationTargetRole(item.user.role) &&
          allowedResignationRoles.includes(item.user.role);

        return (
          <article
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            key={item.key}
          >
            <div className="flex min-w-0 gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                {getInitials(item.user.nameEn) || <UserRound className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {item.user.nameEn}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {item.user.phoneNumber}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="border-orange-200 bg-orange-50 text-orange-700" variant="outline">
                    {formatEnum(item.user.role)}
                  </Badge>
                  <Badge variant="muted">{formatEnum(item.user.employmentStatus)}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              {item.vendor ? (
                <p>
                  <span className="font-semibold text-slate-900">Branch:</span>{" "}
                  {item.vendor.vendorName}
                </p>
              ) : null}
              {item.chain ? (
                <p>
                  <span className="font-semibold text-slate-900">Chain:</span>{" "}
                  {item.chain.chainName}
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-slate-900">Profile:</span>{" "}
                {formatEnum(item.user.profileStatus)}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="min-h-11 rounded-xl"
                onClick={() => onOpenProfile(item.user.id)}
                type="button"
                variant="outline"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Profile
              </Button>
              {canTransfer ? (
                <Button
                  className="min-h-11 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => onOpenTransfer(item)}
                  type="button"
                  variant="outline"
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer
                </Button>
              ) : canResign ? (
                <Button
                  className="min-h-11 rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => onOpenResignation(item.user)}
                  type="button"
                  variant="outline"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Resign
                </Button>
              ) : null}
              {canTransfer && canResign ? (
                <Button
                  className="min-h-11 rounded-xl border-red-200 text-red-700 hover:bg-red-50 sm:col-span-2"
                  onClick={() => onOpenResignation(item.user)}
                  type="button"
                  variant="outline"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  Resign
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

async function fetchUsersAreaData(role: UserRole): Promise<UsersAreaData> {
  if (role === "CHAMP") {
    const workspace = await workspacesApi.champBranches();
    return {
      pickers: workspace.branches.flatMap((branch) =>
        branch.pickers.map((picker) => ({
          key: picker.assignment.id,
          user: picker.picker,
          assignment: picker.assignment,
          vendor: branch.vendor,
          chain: branch.chain
        }))
      ),
      champs: [],
      management: []
    };
  }

  if (role === "AREA_MANAGER") {
    const workspace = await workspacesApi.areaManager();
    return {
      pickers: workspace.chains.flatMap((chain) =>
        chain.vendors.flatMap((vendor) =>
          vendor.pickers.map((picker) => ({
            key: picker.assignment.id,
            user: picker.picker,
            assignment: picker.assignment,
            vendor: vendor.vendor,
            chain: chain.chain
          }))
        )
      ),
      champs: workspace.chains.flatMap((chain) =>
        chain.vendors.flatMap((vendor) =>
          vendor.champs.map((champ) => ({
            key: champ.assignment.id,
            user: champ.champ,
            assignment: champ.assignment,
            vendor: vendor.vendor,
            chain: chain.chain
          }))
        )
      ),
      management: []
    };
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    const users = await fetchAllUsers();
    return {
      pickers: users
        .filter((item) => item.role === "PICKER")
        .map((item) => ({ key: item.id, user: item })),
      champs: users
        .filter((item) => item.role === "CHAMP")
        .map((item) => ({ key: item.id, user: item })),
      management: users
        .filter((item) => managementRoles.includes(item.role))
        .map((item) => ({ key: item.id, user: item }))
    };
  }

  return emptyUsersAreaData();
}

async function fetchAllUsers() {
  const pageSize = 100;
  const firstPage = await usersApi.list({ page: 1, pageSize });
  const users = [...firstPage.items];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const response = await usersApi.list({ page, pageSize });
    users.push(...response.items);
  }

  return users;
}

function getVisibleSections(role: UserRole | undefined) {
  if (role === "CHAMP") {
    return [{ id: "pickers" as const, label: "My Pickers" }];
  }
  if (role === "AREA_MANAGER") {
    return [
      { id: "pickers" as const, label: "My Pickers" },
      { id: "champs" as const, label: "My Champs" }
    ];
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return [
      { id: "pickers" as const, label: "All Pickers" },
      { id: "champs" as const, label: "All Champs" },
      { id: "management" as const, label: "Management Users" }
    ];
  }
  return [];
}

function getAllowedResignationTargetRoles(
  role: UserRole | undefined
): ResignationTargetRole[] {
  if (role === "CHAMP") return ["PICKER"];
  if (role === "AREA_MANAGER") return ["PICKER", "CHAMP"];
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return ["PICKER", "CHAMP", "AREA_MANAGER"];
  }
  return [];
}

function isResignationTargetRole(role: UserRole): role is ResignationTargetRole {
  return role === "PICKER" || role === "CHAMP" || role === "AREA_MANAGER";
}

function filterItems(items: UsersAreaItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) =>
    [
      item.user.nameEn,
      item.user.nameAr,
      item.user.phoneNumber,
      item.vendor?.vendorName,
      item.vendor?.vendorCode,
      item.chain?.chainName,
      item.chain?.chainCode
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalized))
  );
}

function emptyUsersAreaData(): UsersAreaData {
  return { pickers: [], champs: [], management: [] };
}

function getSectionLabel(sectionId: UsersSectionId, role?: UserRole) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    if (sectionId === "pickers") return "All Pickers";
    if (sectionId === "champs") return "All Champs";
  }
  if (sectionId === "pickers") return "My Pickers";
  if (sectionId === "champs") return "My Champs";
  return "Management Users";
}

function toInitialTransferPicker(item: UsersAreaItem): InitialTransferPicker {
  return {
    user: {
      id: item.user.id,
      nameEn: item.user.nameEn,
      phoneNumber: item.user.phoneNumber,
      role: item.user.role
    },
    assignment: item.assignment ?? null,
    vendor: item.vendor ?? null,
    chain: item.chain ?? null
  };
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
