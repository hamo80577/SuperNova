"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { Select } from "./select";

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
const weekdayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type PopoverPosition = {
  left: number;
  placement: "bottom" | "top";
  top: number;
  width: number;
};

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
  const selectedDate = parseIsoDate(value);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    clamp(selectedDate?.getFullYear() ?? startYear ?? today.getFullYear(), minYear, maxYear)
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getMonth() ?? startMonth ?? today.getMonth()
  );
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") {
      return;
    }

    const viewportPadding = 12;
    const estimatedHeight = 390;
    const anchor = buttonRef.current.getBoundingClientRect();
    const availableWidth = window.innerWidth - viewportPadding * 2;
    const width = Math.min(Math.max(anchor.width, 288), 320, availableWidth);
    const hasRoomBelow =
      window.innerHeight - anchor.bottom >= estimatedHeight + viewportPadding;
    const placement = hasRoomBelow ? "bottom" : "top";
    const top =
      placement === "bottom"
        ? anchor.bottom + 8
        : Math.max(viewportPadding, anchor.top - estimatedHeight - 8);
    const preferredLeft =
      align === "end" ? anchor.right - width : anchor.left;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      window.innerWidth - width - viewportPadding
    );

    setPosition({ left, placement, top, width });
  }, [align]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    setViewYear(clamp(selectedDate.getFullYear(), minYear, maxYear));
    setViewMonth(selectedDate.getMonth());
  }, [maxYear, minYear, selectedDate?.getTime()]);

  const years = useMemo(() => {
    const items: number[] = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      items.push(year);
    }
    return items;
  }, [maxYear, minYear]);

  const days = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewMonth, viewYear]
  );
  const displayValue = selectedDate ? formatDisplayDate(selectedDate) : "";

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    const nextYear = clamp(next.getFullYear(), minYear, maxYear);
    setViewYear(nextYear);
    setViewMonth(next.getMonth());
  }

  function selectDate(date: Date) {
    onChange(formatIsoDate(date));
    setOpen(false);
  }

  function runQuickAction(action: QuickAction) {
    const date = new Date(today);
    if (action === "yesterday") {
      date.setDate(date.getDate() - 1);
    }
    selectDate(date);
  }

  const popover =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
            ref={popoverRef}
            style={{
              left: position.left,
              position: "fixed",
              top: position.top,
              width: position.width,
              zIndex: 160
            }}
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
                <Select
                  aria-label="Month"
                  className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm font-medium text-slate-950"
                  onChange={(event) => setViewMonth(Number(event.target.value))}
                  value={viewMonth}
                >
                  {monthNames.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Year"
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-medium text-slate-950"
                  onChange={(event) => setViewYear(Number(event.target.value))}
                  value={viewYear}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
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
              {weekdayNames.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const selected = value === formatIsoDate(day.date);
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
          </div>,
          document.body
        )
      : null;

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
        ref={buttonRef}
        type="button"
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {popover}
    </div>
  );
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: formatIsoDate(date)
    };
  });
}

function parseIsoDate(value?: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
