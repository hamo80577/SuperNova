"use client";

import { ArrowRightLeft, MinusCircle, UserMinus, UserPlus } from "lucide-react";
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
  const canCreateDeduction =
    getAllowedDeductionTargetRoles(user?.role).length > 0;

  return (
    <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-2xl">
      <button
        className="flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!allowedNewHireTargetRoles.length}
        onClick={() => onSelect({ type: "NEW_HIRE" })}
        type="button"
      >
        <UserPlus className="mr-2 h-4 w-4 text-orange-600" />
        New Hire
      </button>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "RESIGNATION" })}
        type="button"
      >
        <UserMinus className="mr-2 h-4 w-4 text-orange-600" />
        Resignation
      </button>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "TRANSFER" })}
        type="button"
      >
        <ArrowRightLeft className="mr-2 h-4 w-4 text-orange-600" />
        Transfer
      </button>
      {canCreateDeduction ? (
        <button
          className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
          onClick={() => onSelect({ type: "DEDUCTION" })}
          type="button"
        >
          <MinusCircle className="mr-2 h-4 w-4 text-orange-600" />
          Deduction
        </button>
      ) : null}
    </div>
  );
}
