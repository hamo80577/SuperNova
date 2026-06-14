"use client";

import {
  ArrowRightLeft,
  CalendarDays,
  MinusCircle,
  UserMinus,
  UserPlus
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getAllowedDeductionTargetRoles } from "@/lib/api/deductions";
import { type NewHireTargetRole } from "@/lib/api/requests";
import { type NewRequestDraft } from "../shared/request-types";

export function NewRequestMenu({
  allowedNewHireTargetRoles,
  onSelect
}: {
  allowedNewHireTargetRoles: NewHireTargetRole[];
  onSelect: (draft: NewRequestDraft) => void;
}) {
  const { user } = useAuth();
  const canCreateLifecycle = user?.role !== "PICKER";
  const canCreateDeduction =
    getAllowedDeductionTargetRoles(user?.role).length > 0;

  return (
    <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-[color:var(--sn-border)] bg-white p-2 text-left shadow-[0_4px_24px_rgba(65,21,23,0.10)]">
      {canCreateLifecycle ? (
        <>
          <button
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--sn-ink)] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!allowedNewHireTargetRoles.length}
            onClick={() => onSelect({ type: "NEW_HIRE" })}
            type="button"
          >
            <UserPlus className="mr-2 h-4 w-4 text-[color:var(--tlb-orange)]" />
            New Hire
          </button>
          <button
            className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--sn-ink)] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)]"
            onClick={() => onSelect({ type: "RESIGNATION" })}
            type="button"
          >
            <UserMinus className="mr-2 h-4 w-4 text-[color:var(--tlb-orange)]" />
            Resignation
          </button>
          <button
            className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--sn-ink)] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)]"
            onClick={() => onSelect({ type: "TRANSFER" })}
            type="button"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4 text-[color:var(--tlb-orange)]" />
            Transfer
          </button>
        </>
      ) : null}
      {canCreateDeduction ? (
        <button
          className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--sn-ink)] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)]"
          onClick={() => onSelect({ type: "DEDUCTION" })}
          type="button"
        >
          <MinusCircle className="mr-2 h-4 w-4 text-[color:var(--tlb-orange)]" />
          Deduction
        </button>
      ) : null}
      {user?.role === "PICKER" || user?.role === "CHAMP" ? (
        <button
          className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-[color:var(--sn-ink)] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)]"
          onClick={() => onSelect({ type: "ANNUAL_LEAVE" })}
          type="button"
        >
          <CalendarDays className="mr-2 h-4 w-4 text-[color:var(--tlb-orange)]" />
          Request Annual Leave
        </button>
      ) : null}
    </div>
  );
}
