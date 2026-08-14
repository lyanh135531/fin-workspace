"use client";

import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/base/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "./date-range-picker";

type MonthRangePickerProps = {
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  minMonth?: string;
  maxMonth?: string;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  spotlight?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function toMonth(value: string): string {
  return value.slice(0, 7);
}

function yearOf(month: string): number {
  return Number(month.slice(0, 4));
}

function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match)
    throw new RangeError(`Invalid month "${month}". Expected yyyy-MM.`);

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}, ${year}`;
}

function formatMonthRange(value: DateRangeValue): string {
  const from = toMonth(value.from);
  const to = toMonth(value.to);
  if (from === to) return formatMonth(from);

  const [fromYear, fromMonth] = from.split("-");
  const [toYear, toMonthNumber] = to.split("-");
  if (fromYear === toYear) {
    return `Tháng ${Number(fromMonth)} – ${Number(toMonthNumber)}, ${toYear}`;
  }

  return `${formatMonth(from)} – ${formatMonth(to)}`;
}

export function MonthRangePicker({
  value,
  onValueChange,
  minMonth,
  maxMonth,
  disabled = false,
  ariaLabel,
  className,
  spotlight = false,
}: MonthRangePickerProps) {
  const selectedFrom = toMonth(value.from);
  const selectedTo = toMonth(value.to);
  const minimumYear = minMonth ? yearOf(minMonth) : yearOf(selectedFrom) - 50;
  const maximumYear = maxMonth ? yearOf(maxMonth) : yearOf(selectedTo) + 50;
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(selectedFrom);
  const [draftTo, setDraftTo] = useState(selectedTo);
  const [displayYear, setDisplayYear] = useState(yearOf(selectedTo));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const isComplete = Boolean(draftFrom && draftTo);

  function resetDraft(): void {
    setDraftFrom(selectedFrom);
    setDraftTo(selectedTo);
    setDisplayYear(yearOf(selectedTo));
    setSelectingEnd(false);
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) resetDraft();
    setOpen(nextOpen);
  }

  function selectMonth(nextMonth: string): void {
    if (!selectingEnd) {
      setDraftFrom(nextMonth);
      setDraftTo("");
      setSelectingEnd(true);
      return;
    }

    if (nextMonth < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(nextMonth);
    } else {
      setDraftTo(nextMonth);
    }
    setSelectingEnd(false);
  }

  function applyRange(): void {
    if (!isComplete) return;
    onValueChange({
      from: `${draftFrom}-01`,
      to: lastDayOfMonth(draftTo),
    });
    setOpen(false);
  }

  const triggerButton = (
    <Button
      type="button"
      variant="filter"
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        "date-range-picker-trigger group",
        className,
      )}
    />
  );

  const triggerContent = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <CalendarRange className="size-3.5 text-primary" aria-hidden="true" />
        <span className="truncate tabular-nums">{formatMonthRange(value)}</span>
      </span>
      <ChevronDown
        className="size-3.5 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
        aria-hidden="true"
      />
    </>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {spotlight ? (
        <SpotlightTrigger
          open={open}
          onOpenChange={handleOpenChange}
          render={triggerButton}
          dismissLabel={`Đóng ${ariaLabel.toLocaleLowerCase("vi")}`}
        >
          {(spotlightTrigger) => (
            <PopoverTrigger render={spotlightTrigger}>
              {triggerContent}
            </PopoverTrigger>
          )}
        </SpotlightTrigger>
      ) : (
        <PopoverTrigger render={triggerButton}>{triggerContent}</PopoverTrigger>
      )}

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[22rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center text-center gap-2 border-b border-border">
          <RangeSummary
            value={draftFrom ? formatMonth(draftFrom) : "Chọn tháng"}
          />
          <span className="font-medium"> - </span>
          <RangeSummary value={draftTo ? formatMonth(draftTo) : "Chọn tháng"} />
        </div>

        <div className="px-3 pb-3 pt-2.5">
          <div className="mb-2 flex items-center justify-between px-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Năm trước"
              disabled={displayYear <= minimumYear}
              onClick={() => setDisplayYear((year) => year - 1)}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <strong className="text-sm font-semibold tabular-nums tracking-[-0.01em]">
              Năm {displayYear}
            </strong>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Năm sau"
              disabled={displayYear >= maximumYear}
              onClick={() => setDisplayYear((year) => year + 1)}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div
            className="grid grid-cols-4 gap-1"
            role="grid"
            aria-label={`Các tháng năm ${displayYear}`}
          >
            {MONTHS.map((month) => {
              const current = monthValue(displayYear, month);
              const isDisabled =
                (minMonth ? current < minMonth : false) ||
                (maxMonth ? current > maxMonth : false);
              const isStart = current === draftFrom;
              const isEnd = current === draftTo;
              const isEdge = isStart || isEnd;
              const isInRange =
                Boolean(draftFrom && draftTo) &&
                current > draftFrom &&
                current < draftTo;

              return (
                <Button
                  key={current}
                  type="button"
                  variant="ghost"
                  size="auto"
                  role="gridcell"
                  aria-label={formatMonth(current)}
                  aria-selected={isEdge || isInRange}
                  disabled={isDisabled}
                  onClick={() => selectMonth(current)}
                  className={cn(
                    "relative h-10 rounded-lg px-1 text-xs font-medium tabular-nums transition-[background-color,color,transform] duration-150 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] focus-visible:z-10",
                    isInRange &&
                      "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                    isEdge &&
                      "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  Tháng {month}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/25 px-3 py-2.5">
          <p
            className="pl-1 text-[0.68rem] leading-4 text-muted-foreground"
            aria-live="polite"
          >
            {selectingEnd
              ? "Chọn tháng kết thúc"
              : "Chọn một tháng để bắt đầu khoảng mới"}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={applyRange}
            disabled={!isComplete || selectingEnd}
            className="min-w-[5.5rem] shadow-sm"
          >
            <Check aria-hidden="true" />
            Áp dụng
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeSummary({ value }: { value: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-transparent px-2.5 py-2 transition-colors",
      )}
    >
      <strong
        className={cn(
          "mt-0.5 block truncate text-xs font-semibold tabular-nums",
          value === "Chọn tháng" && "font-medium text-muted-foreground",
        )}
      >
        {value}
      </strong>
    </div>
  );
}

export type { MonthRangePickerProps };
