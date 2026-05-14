"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type QuickAction = "today" | "yesterday";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
  align = "start",
  className,
  disabled,
  maxYear = new Date().getFullYear() + 5,
  minYear = 1950,
  onChange,
  placeholder = "Select date",
  quickActions = [],
  startMonth,
  startYear,
  value
}: {
  align?: "start" | "end";
  className?: string;
  disabled?: boolean;
  maxYear?: number;
  minYear?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  quickActions?: QuickAction[];
  startMonth?: number;
  startYear?: number;
  value?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const parsed = value ? parseDateValue(value) : null;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    clamp(parsed?.getFullYear() ?? startYear ?? today.getFullYear(), minYear, maxYear)
  );
  const [viewMonth, setViewMonth] = useState(
    parsed?.getMonth() ?? startMonth ?? today.getMonth()
  );
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!parsed) return;
    setViewYear(clamp(parsed.getFullYear(), minYear, maxYear));
    setViewMonth(parsed.getMonth());
  }, [maxYear, minYear, parsed?.getTime()]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("pointerdown", handlePointerDown);
    }
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const days = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewMonth, viewYear]);
  const years = [];
  for (let year = minYear; year <= maxYear; year += 1) years.push(year);

  function moveMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(clamp(next.getFullYear(), minYear, maxYear));
    setViewMonth(next.getMonth());
  }

  function selectDate(date: Date) {
    onChange(formatDateValue(date));
    setOpen(false);
  }

  function runQuickAction(action: QuickAction) {
    const date = new Date();
    if (action === "yesterday") date.setDate(date.getDate() - 1);
    selectDate(date);
  }

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-white px-3 text-left text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-60",
          value ? "text-slate-950" : "text-slate-500",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{parsed ? formatDisplayDate(parsed) : placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-[160] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-2">
              <select
                className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm font-medium text-slate-950"
                onChange={(event) => setViewMonth(Number(event.target.value))}
                value={viewMonth}
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-medium text-slate-950"
                onChange={(event) => setViewYear(Number(event.target.value))}
                value={viewYear}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {dayNames.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const selected = value === formatDateValue(day.date);
              const inMonth = day.date.getMonth() === viewMonth;
              return (
                <button
                  className={cn(
                    "grid h-9 place-items-center rounded-xl text-sm transition",
                    inMonth ? "text-slate-800" : "text-slate-300",
                    selected
                      ? "bg-orange-600 font-semibold text-white"
                      : "hover:bg-orange-50 hover:text-orange-700"
                  )}
                  key={day.key}
                  onClick={() => selectDate(day.date)}
                  type="button"
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {quickActions.includes("yesterday") ? (
                <button
                  className="h-8 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => runQuickAction("yesterday")}
                  type="button"
                >
                  Yesterday
                </button>
              ) : null}
              {quickActions.includes("today") ? (
                <button
                  className="h-8 rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-medium text-orange-700 hover:bg-orange-100"
                  onClick={() => runQuickAction("today")}
                  type="button"
                >
                  Today
                </button>
              ) : null}
            </div>
            {value ? (
              <button
                className="h-8 rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, key: formatDateValue(date) };
  });
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
