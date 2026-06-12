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
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[color:var(--sn-muted)]" />
          <Input
            className="h-11 rounded-2xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] pl-9 shadow-sm transition focus-visible:ring-[color:var(--tlb-orange)]"
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
                "h-11 rounded-2xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-[color:var(--sn-body)] shadow-sm hover:border-[#FFD8BD] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)]",
                hasActiveFilters(filters) &&
                  "border-[#FFD8BD] bg-[#FFE8D9] text-[color:var(--tlb-orange-900)]"
              )}
              onClick={onToggleFilters}
              type="button"
              variant="outline"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters(filters) ? (
                <span className="ml-2 rounded-full bg-[#FFE8D9] px-2 py-0.5 text-xs font-semibold text-[color:var(--tlb-orange-900)]">
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
      className="grid h-11 grid-cols-2 rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] p-1 shadow-sm"
      role="group"
    >
      <button
        aria-label="Cards view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl text-[color:var(--sn-muted)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]",
          value === "cards"
            ? "bg-[color:var(--sn-card)] text-[color:var(--tlb-orange-900)] shadow-sm ring-1 ring-[#FFD8BD]"
            : "hover:bg-[color:var(--sn-card)] hover:text-[color:var(--sn-ink)]"
        )}
        onClick={() => onChange("cards")}
        type="button"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        aria-label="Rows view"
        className={cn(
          "grid h-9 w-10 place-items-center rounded-xl text-[color:var(--sn-muted)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]",
          value === "rows"
            ? "bg-[color:var(--sn-card)] text-[color:var(--tlb-orange-900)] shadow-sm ring-1 ring-[#FFD8BD]"
            : "hover:bg-[color:var(--sn-card)] hover:text-[color:var(--sn-ink)]"
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
    <div className="rounded-2xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] p-3 shadow-sm">
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
          className="mt-3 h-10 rounded-xl border-[color:var(--sn-border)] bg-[color:var(--sn-card)] text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)]"
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
    <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sn-muted)]">
      {label}
      <Select
        className="h-11 rounded-xl border border-[color:var(--sn-border)] bg-[color:var(--sn-card)] px-3 text-sm text-[color:var(--sn-ink)]"
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
          className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#FFD8BD] bg-[#FFE8D9] px-3 text-xs font-semibold text-[color:var(--tlb-orange-900)] transition hover:bg-[#FFD8BD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)]"
          key={key}
          onClick={() => onClear(key)}
          type="button"
        >
          <span className="text-[color:var(--tlb-orange)]">{getFilterName(key)}</span>
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
