import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RequestType } from "@/lib/api/requests";
import { cn } from "@/lib/utils";

import { requestTypes } from "../shared/request-constants";
import type { OperationsMode } from "../shared/request-types";
import { formatEnum } from "../shared/request-utils";

const operationModes: Array<[OperationsMode, string]> = [
  ["action", "My action required"],
  ["submitted", "Submitted by me"],
  ["open", "Open"],
  ["completed", "Completed"],
  ["rejected", "Rejected"]
];

export function RequestFilters({
  mode,
  onApply,
  onModeChange,
  onQueryChange,
  onTypeChange,
  query,
  type
}: {
  mode: OperationsMode;
  onApply: () => void;
  onModeChange: (mode: OperationsMode) => void;
  onQueryChange: (query: string) => void;
  onTypeChange: (type: RequestType | "") => void;
  query: string;
  type: RequestType | "";
}) {
  return (
    <div className="grid gap-3 p-4 sm:p-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {operationModes.map(([value, label]) => (
          <button
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              mode === value
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"
            )}
            key={value}
            onClick={() => onModeChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
        <Input
          className="h-11 rounded-xl"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search picker, branch, chain, creator"
          value={query}
        />
        <select
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
          onChange={(event) => onTypeChange(event.target.value as RequestType | "")}
          value={type}
        >
          <option value="">All request types</option>
          {requestTypes.map((value) => (
            <option key={value} value={value}>
              {formatEnum(value)}
            </option>
          ))}
        </select>
        <Button
          className="h-11 rounded-xl"
          onClick={onApply}
          type="button"
          variant="outline"
        >
          <Filter className="mr-2 h-4 w-4" />
          Apply
        </Button>
      </div>
    </div>
  );
}
