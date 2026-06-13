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
    <section className="rounded-[16px] border border-[color:var(--sn-border)] bg-white p-4 shadow-[0_1px_2px_rgba(65,21,23,0.05),0_4px_16px_rgba(65,21,23,0.06)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--sn-ink)]">Pickers</h2>
          <p className="mt-1 text-sm text-[color:var(--sn-muted)]">
            Active Picker assignments in this Branch.
          </p>
        </div>
        <Badge variant="muted">{pickers.length} active</Badge>
      </div>
      {pickers.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[color:var(--sn-border)] text-xs uppercase text-[color:var(--sn-faint)]">
              <tr>
                <th className="py-3 pr-4">Picker</th>
                <th className="py-3 pr-4">Phone</th>
                <th className="py-3 pr-4">Employment</th>
                <th className="py-3 pr-4">Account</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pickers.map((scopedPicker) => {
                const picker = scopedPicker.picker;
                return (
                  <tr
                    className="cursor-pointer border-b border-[color:var(--sn-border)] last:border-0 hover:bg-[#FFE8D9]/40"
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
                      <p className="font-semibold text-[color:var(--sn-ink)]">{picker.nameEn}</p>
                      {picker.nameAr ? (
                        <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
                          {picker.nameAr}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-[color:var(--sn-body)]">
                      {picker.phoneNumber}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{formatEnum(picker.employmentStatus)}</Badge>
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
