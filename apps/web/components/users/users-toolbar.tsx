"use client";

import { Filter, LayoutGrid, Rows3, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UserRole } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import type {
  FilterOption,
  UsersFilterKey,
  UsersFilterOptions,
  UsersFilters,
  ViewMode
} from "./users-area-types";

export function UsersToolbar({
  filters,
  filtersOpen,
  onChangeFilter,
  onClearAllFilters,
  onClearFilter,
  onQueryChange,
  onToggleFilters,
  onViewModeChange,
  options,
  query,
  showAdvancedFilters,
  viewMode,
  viewerRole
}: {
  filters: UsersFilters;
  filtersOpen: boolean;
  onChangeFilter: (key: UsersFilterKey, value: string) => void;
  onClearAllFilters: () => void;
  onClearFilter: (key: UsersFilterKey) => void;
  onQueryChange: (value: string) => void;
  onToggleFilters: () => void;
  onViewModeChange: (value: ViewMode) => void;
  options: UsersFilterOptions;
  query: string;
  showAdvancedFilters: boolean;
  viewMode: ViewMode;
  viewerRole?: UserRole;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative min-w-0 lg:w-[380px]">
          <span className="sr-only">Search users</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            className="h-11 rounded-2xl border-slate-200 bg-white pl-9 shadow-sm transition focus-visible:ring-orange-500"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search name, phone, Branch, Chain"
            value={query}
          />
        </label>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          {showAdvancedFilters ? (
            <Button
              aria-expanded={filtersOpen}
              className={cn(
                "h-11 rounded-2xl border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700",
                hasActiveFilters(filters) &&
                  "border-orange-200 bg-orange-50 text-orange-700"
              )}
              onClick={onToggleFilters}
              type="button"
              variant="outline"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters(filters) ? (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                  {activeFilterCount(filters)}
                </span>
              ) : null}
            </Button>
          ) : (
            <span />
          )}

          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {showAdvancedFilters && filtersOpen ? (
        <UsersFilterPanel
          filters={filters}
          onChange={onChangeFilter}
          onClearAll={onClearAllFilters}
          options={options}
          viewerRole={viewerRole}
        />
      ) : null}

      <ActiveFilterChips
        filters={filters}
        onClear={onClearFilter}
        options={options}
      />
    </section>
  );
}

function ViewModeToggle({
  onChange,
  value
}: {
  onChange: (value: ViewMode) => void;
  value: ViewMode;
}) {
  return (
    <div
      aria-label="Users view"
      className="grid h-11 grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
      role="group"
    >
      <button
        aria-label="Cards view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
          value === "cards"
            ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
            : "hover:bg-white hover:text-slate-900"
        )}
        onClick={() => onChange("cards")}
        type="button"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        aria-label="Rows view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
          value === "rows"
            ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"
            : "hover:bg-white hover:text-slate-900"
        )}
        onClick={() => onChange("rows")}
        type="button"
      >
        <Rows3 className="h-4 w-4" />
      </button>
    </div>
  );
}

function UsersFilterPanel({
  filters,
  onChange,
  onClearAll,
  options,
  viewerRole
}: {
  filters: UsersFilters;
  onChange: (key: UsersFilterKey, value: string) => void;
  onClearAll: () => void;
  options: UsersFilterOptions;
  viewerRole?: UserRole;
}) {
  const admin = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Chain"
          onChange={(value) => onChange("chainId", value)}
          options={options.chains}
          value={filters.chainId}
        />
        <FilterSelect
          label="Branch"
          onChange={(value) => onChange("vendorId", value)}
          options={options.vendors}
          value={filters.vendorId}
        />
        {admin ? (
          <FilterSelect
            label="Area Manager"
            onChange={(value) => onChange("areaManagerId", value)}
            options={options.areaManagers}
            value={filters.areaManagerId}
          />
        ) : null}
        <FilterSelect
          label="Champ"
          onChange={(value) => onChange("champId", value)}
          options={options.champs}
          value={filters.champId}
        />
      </div>
      {hasActiveFilters(filters) ? (
        <Button
          className="mt-3 h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={onClearAll}
          type="button"
          variant="outline"
        >
          <X className="mr-2 h-4 w-4" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
      {label}
      <Select
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
        disabled={!options.length}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
            {option.hint ? ` (${option.hint})` : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}

function ActiveFilterChips({
  filters,
  onClear,
  options
}: {
  filters: UsersFilters;
  onClear: (key: UsersFilterKey) => void;
  options: UsersFilterOptions;
}) {
  const active = (Object.entries(filters) as Array<[UsersFilterKey, string]>).filter(
    ([, value]) => Boolean(value)
  );

  if (!active.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([key, value]) => (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 text-xs font-semibold text-orange-800 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          key={key}
          onClick={() => onClear(key)}
          type="button"
        >
          <span className="text-orange-600">{getFilterName(key)}</span>
          {getFilterLabel(key, value, options)}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function hasActiveFilters(filters: UsersFilters) {
  return activeFilterCount(filters) > 0;
}

function activeFilterCount(filters: UsersFilters) {
  return Object.values(filters).filter(Boolean).length;
}

function getFilterName(key: UsersFilterKey) {
  if (key === "chainId") return "Chain";
  if (key === "vendorId") return "Branch";
  if (key === "areaManagerId") return "Area Manager";
  return "Champ";
}

function getFilterLabel(
  key: UsersFilterKey,
  value: string,
  options: UsersFilterOptions
) {
  const source =
    key === "chainId"
      ? options.chains
      : key === "vendorId"
        ? options.vendors
        : key === "areaManagerId"
          ? options.areaManagers
          : options.champs;
  return source.find((option) => option.id === value)?.label ?? value;
}
