"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScopedPicker } from "@/lib/api/workspaces";
import { EmptyState } from "./champ-branch-states";
import { formatEnum } from "./champ-branch-utils";

export function BranchPickers({
  onOpenPicker,
  pickers
}: {
  onOpenPicker: (picker: ScopedPicker) => void;
  pickers: ScopedPicker[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Pickers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Active Picker assignments in this Branch.
          </p>
        </div>
        <Badge variant="muted">{pickers.length} active</Badge>
      </div>
      {pickers.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Picker</th>
                <th className="py-3 pr-4">Phone</th>
                <th className="py-3 pr-4">Employment</th>
                <th className="py-3 pr-4">Profile</th>
                <th className="py-3 pr-4">Account</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pickers.map((scopedPicker) => {
                const picker = scopedPicker.picker;
                return (
                  <tr
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-orange-50/40"
                    key={picker.id}
                    onClick={() => onOpenPicker(scopedPicker)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        onOpenPicker(scopedPicker);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-950">{picker.nameEn}</p>
                      {picker.nameAr ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {picker.nameAr}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {picker.phoneNumber}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{formatEnum(picker.employmentStatus)}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="muted">{formatEnum(picker.profileStatus)}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{formatEnum(picker.accountStatus)}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        className="h-9 rounded-xl"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenPicker(scopedPicker);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No active Pickers are assigned to this Branch." />
      )}
    </section>
  );
}
