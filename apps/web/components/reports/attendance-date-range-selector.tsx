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

import {
  formatIsoDate,
  formatRangeInputDate,
  getAttendanceQuickRange,
  getNextAttendanceRangeSelection,
  parseIsoDate,
  yesterdayIsoDate,
  type AttendanceDateRangeValue,
  type AttendanceQuickRange,
  type AttendanceRangeBoundary
} from "./attendance-date-range";
import { cn } from "@/lib/utils";

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
const weekdayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const quickActions: Array<{ label: string; value: AttendanceQuickRange }> = [
  { label: "Yesterday", value: "yesterday" },
  { label: "Last Week", value: "lastWeek" },
  { label: "This Month", value: "thisMonth" }
];

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
}

export function AttendanceDateRangeSelector({
  dateFrom,
  dateTo,
  error,
  onChange
}: {
  dateFrom: string;
  dateTo: string;
  error: string | null;
  onChange: (dateFrom: string, dateTo: string) => void;
}) {
  const maxDate = yesterdayIsoDate();
  const [activeBoundary, setActiveBoundary] =
    useState<AttendanceRangeBoundary>("start");
  const [draftRange, setDraftRange] = useState<AttendanceDateRangeValue>({
    dateFrom,
    dateTo
  });
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [viewMonth, setViewMonth] = useState(() => parseIsoDate(dateFrom).getMonth());
  const [viewYear, setViewYear] = useState(() => parseIsoDate(dateFrom).getFullYear());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const formattedRange = useMemo(
    () => `${formatRangeInputDate(dateFrom)} - ${formatRangeInputDate(dateTo)}`,
    [dateFrom, dateTo]
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") {
      return;
    }

    const viewportPadding = 12;
    const desktop = window.innerWidth >= 768;
    const estimatedHeight = desktop ? 390 : 480;
    const anchor = triggerRef.current.getBoundingClientRect();
    const availableWidth = window.innerWidth - viewportPadding * 2;
    const width = Math.min(desktop ? 704 : 360, availableWidth);
    const hasRoomBelow =
      window.innerHeight - anchor.bottom >= estimatedHeight + viewportPadding;
    const top = hasRoomBelow
      ? anchor.bottom + 8
      : Math.max(viewportPadding, anchor.top - estimatedHeight - 8);
    const left = Math.min(
      Math.max(viewportPadding, anchor.left),
      window.innerWidth - width - viewportPadding
    );

    setPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!open) {
      setDraftRange({ dateFrom, dateTo });
    }
  }, [dateFrom, dateTo, open]);

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

  function openFor(boundary: AttendanceRangeBoundary) {
    const focusDate = boundary === "end" ? dateTo : dateFrom;
    const parsedFocusDate = parseIsoDate(focusDate);
    setDraftRange({ dateFrom, dateTo });
    setActiveBoundary(boundary);
    setViewMonth(parsedFocusDate.getMonth());
    setViewYear(parsedFocusDate.getFullYear());
    setOpen(true);
  }

  function applyRange(nextRange: AttendanceDateRangeValue) {
    onChange(nextRange.dateFrom, nextRange.dateTo);
    setOpen(false);
  }

  function selectDate(selectedDate: string) {
    const nextSelection = getNextAttendanceRangeSelection({
      activeBoundary,
      currentRange: draftRange,
      selectedDate
    });
    setDraftRange(nextSelection.range);
    setActiveBoundary(nextSelection.activeBoundary);

    if (nextSelection.apply) {
      applyRange(nextSelection.range);
    }
  }

  function runQuickAction(action: AttendanceQuickRange) {
    applyRange(getAttendanceQuickRange(action, maxDate));
  }

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const canMoveNext = `${viewYear}-${String(viewMonth + 2).padStart(2, "0")}` <= maxDate.slice(0, 7);
  const canMovePrevious = viewYear > 1950 || viewMonth > 0;
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
              zIndex: 260
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                aria-label="Previous month"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!canMovePrevious}
                onClick={() => moveMonth(-1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  {activeBoundary === "start" ? "Start date" : "End date"}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-950">
                  {formatRangeInputDate(draftRange.dateFrom)} - {formatRangeInputDate(draftRange.dateTo)}
                </p>
              </div>
              <button
                aria-label="Next month"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!canMoveNext}
                onClick={() => moveMonth(1)}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <MonthPanel
                activeBoundary={activeBoundary}
                dateFrom={draftRange.dateFrom}
                dateTo={draftRange.dateTo}
                maxDate={maxDate}
                onSelect={selectDate}
                viewDate={new Date(viewYear, viewMonth, 1)}
              />
              <MonthPanel
                activeBoundary={activeBoundary}
                className="hidden md:block"
                dateFrom={draftRange.dateFrom}
                dateTo={draftRange.dateTo}
                maxDate={maxDate}
                onSelect={selectDate}
                viewDate={new Date(viewYear, viewMonth + 1, 1)}
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-3 border-t border-slate-100 pt-3">
              {quickActions.map((action) => (
                <button
                  className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  key={action.value}
                  onClick={() => runQuickAction(action.value)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="min-w-0 basis-full sm:basis-auto sm:min-w-[22rem]" ref={rootRef}>
      <div
        className={cn(
          "grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center rounded-xl border bg-white shadow-sm transition",
          error ? "border-rose-200" : "border-slate-200"
        )}
        ref={triggerRef}
      >
        <button
          aria-label="Choose attendance start date"
          className="min-w-0 rounded-l-xl px-3 py-2 text-left text-sm font-medium tabular-nums text-slate-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => openFor("start")}
          type="button"
        >
          <span className="block text-[11px] font-semibold uppercase text-slate-400">
            Start
          </span>
          <span className="block truncate">{formatRangeInputDate(dateFrom)}</span>
        </button>
        <span className="h-8 w-px bg-slate-200" />
        <button
          aria-label="Choose attendance end date"
          className="min-w-0 px-3 py-2 text-left text-sm font-medium tabular-nums text-slate-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => openFor("end")}
          type="button"
        >
          <span className="block text-[11px] font-semibold uppercase text-slate-400">
            End
          </span>
          <span className="block truncate">{formatRangeInputDate(dateTo)}</span>
        </button>
        <button
          aria-label={`Choose attendance date range, current range ${formattedRange}`}
          className="mr-1 grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => openFor("start")}
          type="button"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : null}
      {popover}
    </div>
  );
}

function MonthPanel({
  activeBoundary,
  className,
  dateFrom,
  dateTo,
  maxDate,
  onSelect,
  viewDate
}: {
  activeBoundary: AttendanceRangeBoundary;
  className?: string;
  dateFrom: string;
  dateTo: string;
  maxDate: string;
  onSelect: (value: string) => void;
  viewDate: Date;
}) {
  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const month = viewDate.getMonth();

  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="text-center text-base font-semibold text-slate-950">
        {monthNames[month]} {viewDate.getFullYear()}
      </h2>
      <div className="mt-3 grid grid-cols-7 gap-px text-center text-[11px] font-medium text-slate-400">
        {weekdayNames.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
        {days.map((day) => {
          const value = formatIsoDate(day.date);
          const inMonth = day.date.getMonth() === month;
          const selectedStart = value === dateFrom;
          const selectedEnd = value === dateTo;
          const inRange = value > dateFrom && value < dateTo;
          const disabled =
            value > maxDate || (activeBoundary === "end" && value < dateFrom);

          return (
            <button
              aria-label={formatRangeInputDate(value)}
              className={cn(
                "grid h-9 place-items-center bg-white text-sm tabular-nums transition focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                inMonth ? "text-slate-700" : "text-slate-300",
                inRange && "bg-primary/10 text-primary",
                (selectedStart || selectedEnd) &&
                  "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                !disabled &&
                  !selectedStart &&
                  !selectedEnd &&
                  "hover:bg-primary/10 hover:text-primary",
                disabled &&
                  "cursor-not-allowed bg-slate-50 text-slate-300 opacity-60 hover:bg-slate-50 hover:text-slate-300"
              )}
              disabled={disabled}
              key={day.key}
              onClick={() => onSelect(value)}
              type="button"
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function buildMonthGrid(viewDate: Date) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: formatIsoDate(date)
    };
  });
}
