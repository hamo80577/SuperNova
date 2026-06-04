import { Search, SlidersHorizontal, UsersRound } from "lucide-react";

import {
  directoryPlaceholder,
  movementPlaceholders,
  roleSwitcherPlaceholders,
  usersResetHeader
} from "./users-reset-scaffold";

export function UsersAreaPage() {
  return (
    <main className="grid min-w-0 gap-4">
      <UsersResetHeader />
      <RoleSwitcherPlaceholder />
      <MovementCardsPlaceholder />
      <UserDirectoryPlaceholder />
    </main>
  );
}

function UsersResetHeader() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
          {usersResetHeader.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {usersResetHeader.description}
        </p>
      </div>
    </section>
  );
}

function RoleSwitcherPlaceholder() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div
        aria-label="Future user role switcher"
        className="grid gap-2 sm:grid-cols-3"
        role="group"
      >
        {roleSwitcherPlaceholders.map((label, index) => (
          <button
            className={
              index === 0
                ? "min-h-11 rounded-xl border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-orange-700 opacity-80"
                : "min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 opacity-75"
            }
            disabled
            key={label}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MovementCardsPlaceholder() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {movementPlaceholders.map((label) => (
        <article
          className="min-h-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          key={label}
        >
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <div className="mt-5 h-7 w-24 rounded-lg bg-slate-100" />
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Placeholder for the next rebuild phase.
          </p>
        </article>
      ))}
    </section>
  );
}

function UserDirectoryPlaceholder() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-100 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">
            {directoryPlaceholder.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {directoryPlaceholder.description}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:w-72">
            <span className="sr-only">Search users placeholder</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-500 outline-none disabled:cursor-not-allowed disabled:opacity-75"
              disabled
              placeholder="Search placeholder"
              type="search"
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500 opacity-75"
            disabled
            type="button"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters placeholder
          </button>
        </div>
      </div>

      <div className="grid min-h-72 place-items-center p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <UsersRound className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-800">
            Table placeholder / empty state
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {directoryPlaceholder.emptyState}
          </p>
        </div>
      </div>
    </section>
  );
}
