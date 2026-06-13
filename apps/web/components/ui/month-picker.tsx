"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const monthLabelsShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
const monthLabelsLong = [
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

type ParsedMonth = { month: number; year: number };

type PopoverPosition = {
  left: number;
  placement: "bottom" | "top";
  top: number;
  width: number;
};

export function MonthPicker({
  align = "start",
  className,
  disabled,
  maxMonth,
  maxYear = new Date().getFullYear() + 5,
  minMonth,
  minYear = 2020,
  onChange,
  placeholder = "Select month",
  value
}: {
  align?: "start" | "end";
  className?: string;
  disabled?: boolean;
  maxMonth?: string;
  maxYear?: number;
  minMonth?: string;
  minYear?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value?: string;
}) {
  const selected = parseMonth(value);
  const today = useMemo(() => new Date(), []);
  const minBound = useMemo(() => parseMonth(minMonth), [minMonth]);
  const maxBound = useMemo(() => parseMonth(maxMonth), [maxMonth]);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    clamp(selected?.year ?? today.getFullYear(), minYear, maxYear)
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
    const estimatedHeight = 260;
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
    const preferredLeft = align === "end" ? anchor.right - width : anchor.left;
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
    setViewYear(
      clamp(selected?.year ?? today.getFullYear(), minYear, maxYear)
    );
  }, [maxYear, minYear, selected?.year, today]);

  const canGoPrevYear = viewYear > minYear;
  const canGoNextYear = viewYear < maxYear;
  const displayValue = selected
    ? `${monthLabelsLong[selected.month]} ${selected.year}`
    : "";

  function moveYear(offset: number) {
    setViewYear((current) => clamp(current + offset, minYear, maxYear));
  }

  function selectMonth(monthIndex: number) {
    if (isMonthOutsideBounds(viewYear, monthIndex, minBound, maxBound)) {
      return;
    }

    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  const popover =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            className="rounded-2xl border border-[color:var(--sn-border)] bg-white p-3 shadow-2xl"
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
                aria-label="Previous year"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--sn-border)] text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canGoPrevYear}
                onClick={() => moveYear(-1)}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold tabular-nums text-[color:var(--sn-ink)]">
                {viewYear}
              </span>
              <button
                aria-label="Next year"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[color:var(--sn-border)] text-[color:var(--sn-body)] hover:bg-[color:var(--sn-sunken)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canGoNextYear}
                onClick={() => moveYear(1)}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {monthLabelsShort.map((label, index) => {
                const isSelected =
                  selected?.year === viewYear && selected?.month === index;
                const monthDisabled = isMonthOutsideBounds(
                  viewYear,
                  index,
                  minBound,
                  maxBound
                );
                return (
                  <button
                    className={cn(
                      "grid h-10 place-items-center rounded-xl text-sm font-medium transition",
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-[color:var(--sn-ink)] hover:bg-primary/10 hover:text-primary",
                      monthDisabled &&
                        "cursor-not-allowed text-[color:var(--sn-faint)] opacity-45 hover:bg-transparent hover:text-[color:var(--sn-faint)]"
                    )}
                    disabled={monthDisabled}
                    key={label}
                    onClick={() => selectMonth(index)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {value ? (
              <div className="mt-3 flex justify-end border-t border-[color:var(--sn-border)] pt-3">
                <button
                  className="h-8 rounded-xl px-3 text-xs font-medium text-[color:var(--sn-muted)] transition hover:bg-[color:var(--sn-sunken)]"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-white px-3 text-left text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
          value ? "text-[color:var(--sn-ink)]" : "text-[color:var(--sn-muted)]",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[color:var(--sn-muted)]" />
      </button>
      {popover}
    </div>
  );
}

function parseMonth(value?: string): ParsedMonth | null {
  if (!value) {
    return null;
  }

  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return { month: month - 1, year };
}

function isMonthOutsideBounds(
  year: number,
  month: number,
  minBound: ParsedMonth | null,
  maxBound: ParsedMonth | null
) {
  const ordinal = year * 12 + month;

  if (minBound && ordinal < minBound.year * 12 + minBound.month) {
    return true;
  }

  if (maxBound && ordinal > maxBound.year * 12 + maxBound.month) {
    return true;
  }

  return false;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
