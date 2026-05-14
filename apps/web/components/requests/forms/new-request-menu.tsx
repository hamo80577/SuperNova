"use client";

import { ChevronDown } from "lucide-react";
import { type NewHireTargetRole } from "@/lib/api/requests";
import { type NewRequestDraft } from "../shared/request-types";
import { formatEnum } from "../shared/request-utils";

export function NewRequestMenu({
  allowedNewHireTargetRoles,
  onSelect
}: {
  allowedNewHireTargetRoles: NewHireTargetRole[];
  onSelect: (draft: NewRequestDraft) => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-2xl">
      <div className="group relative">
        <button
          className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allowedNewHireTargetRoles.length}
          type="button"
        >
          <span>New Hire</span>
          <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
        </button>
        <div className="mt-1 hidden gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1 group-focus-within:grid group-hover:grid sm:absolute sm:right-full sm:top-0 sm:mt-0 sm:w-52 sm:bg-white sm:shadow-xl">
          {allowedNewHireTargetRoles.map((role) => (
            <button
              className="min-h-10 rounded-lg px-3 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
              key={role}
              onClick={() => onSelect({ type: "NEW_HIRE", targetRole: role })}
              type="button"
            >
              {formatEnum(role)}
            </button>
          ))}
        </div>
      </div>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "RESIGNATION" })}
        type="button"
      >
        Resignation
      </button>
      <button
        className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-orange-50 hover:text-orange-700"
        onClick={() => onSelect({ type: "TRANSFER" })}
        type="button"
      >
        Transfer
      </button>
    </div>
  );
}
