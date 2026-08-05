"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/base/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseIsoDate, toIsoDate } from "./date-picker";

export type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerProps = {
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
};

type CompleteDateRange = {
  from: Date;
  to: Date;
};

function toCalendarRange(value: DateRangeValue): CompleteDateRange {
  const from = parseIsoDate(value.from);
  const to = parseIsoDate(value.to);

  if (!from || !to) {
    throw new RangeError("A date range requires both a from and to date.");
  }

  if (from > to) {
    throw new RangeError(
      `Invalid date range "${value.from}"–"${value.to}". The from date must not be after the to date.`,
    );
  }

  return { from, to };
}

function fromCalendarRange(
  value: DateRange | undefined,
): DateRangeValue | undefined {
  if (!value?.from || !value.to) return undefined;
  return { from: toIsoDate(value.from), to: toIsoDate(value.to) };
}

function formatRange(value: DateRangeValue): string {
  const range = toCalendarRange(value);
  const isSameYear = range.from.getFullYear() === range.to.getFullYear();
  const fromFormat = isSameYear ? "dd MMM" : "dd MMM yyyy";
  return `${format(range.from, fromFormat, { locale: vi })} – ${format(range.to, "dd MMM yyyy", { locale: vi })}`;
}

function formatDraftDate(value: Date | undefined): string {
  return value ? format(value, "dd/MM/yyyy", { locale: vi }) : "Chưa chọn";
}

export function DateRangePicker({
  value,
  onValueChange,
  minDate,
  maxDate,
  disabled = false,
  ariaLabel,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    toCalendarRange(value),
  );
  const selectedRange = useMemo(() => toCalendarRange(value), [value]);
  const minimumDate = useMemo(() => parseIsoDate(minDate), [minDate]);
  const maximumDate = useMemo(() => parseIsoDate(maxDate), [maxDate]);
  const navigationStartMonth = useMemo(
    () => minimumDate ?? new Date(new Date().getFullYear() - 50, 0, 1),
    [minimumDate],
  );
  const navigationEndMonth = useMemo(
    () => maximumDate ?? new Date(new Date().getFullYear() + 50, 11, 31),
    [maximumDate],
  );

  const disabledDates = [
    ...(minimumDate ? [{ before: minimumDate }] : []),
    ...(maximumDate ? [{ after: maximumDate }] : []),
  ];

  function selectRange(nextRange: DateRange | undefined): void {
    setDraft(nextRange);
  }

  function applyRange(): void {
    const nextValue = fromCalendarRange(draft);
    if (!nextValue) return;
    onValueChange(nextValue);
    setOpen(false);
  }

  function cancelSelection(): void {
    setDraft(selectedRange);
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) setDraft(selectedRange);
    setOpen(nextOpen);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "date-range-picker-trigger border border-input shadow-none transition-colors hover:bg-white outline-none select-none bg-white",
              className,
            )}
          />
        }
      >
        <span className="truncate tabular-nums">{formatRange(value)}</span>
        <CalendarDays aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="date-range-picker-popover"
      >
        <Calendar
          mode="range"
          selected={draft}
          defaultMonth={draft?.to ?? draft?.from ?? selectedRange.to}
          onSelect={selectRange}
          resetOnSelect
          captionLayout="dropdown"
          startMonth={navigationStartMonth}
          endMonth={navigationEndMonth}
          reverseYears
          disabled={disabledDates.length ? disabledDates : undefined}
          locale={vi}
          formatters={{
            formatCaption: (month: Date): string =>
              format(month, "'Tháng' M, yyyy", { locale: vi }),
            formatMonthDropdown: (month: Date): string =>
              format(month, "'Tháng' M", { locale: vi }),
            formatWeekdayName: (day: Date): string =>
              day.getDay() === 0 ? "CN" : `T${day.getDay() + 1}`,
          }}
          numberOfMonths={1}
          autoFocus
          className="date-range-picker-calendar [--cell-radius:0.5rem] [--cell-size:2.15rem]"
        />
        <div className="date-range-picker-summary" aria-live="polite">
          <div>
            <span>Từ ngày</span>
            <strong>{formatDraftDate(draft?.from)}</strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>Đến ngày</span>
            <strong>{formatDraftDate(draft?.to)}</strong>
          </div>
        </div>
        <div className="date-range-picker-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelSelection}
          >
            <X aria-hidden="true" />
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={applyRange}
            disabled={!draft?.from || !draft.to}
          >
            <Check aria-hidden="true" />
            Áp dụng
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { DateRangePickerProps };
