"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/base/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { cn } from "@/lib/utils";
import { parseIsoDate, toIsoDate } from "./date-picker";

export type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerProps = {
  value: DateRangeValue | null;
  onValueChange: (value: DateRangeValue | null) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  allowClear?: boolean;
  ariaLabel: string;
  className?: string;
  spotlight?: boolean;
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
  const fromFormat = isSameYear ? "dd/MM" : "dd/MM/yyyy";
  return `${format(range.from, fromFormat, { locale: vi })} – ${format(range.to, "dd/MM/yyyy", { locale: vi })}`;
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
  allowClear = false,
  ariaLabel,
  className,
  spotlight = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    value ? toCalendarRange(value) : undefined,
  );
  const selectedRange = useMemo(
    () => (value ? toCalendarRange(value) : undefined),
    [value],
  );
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

  function clearSelection(): void {
    onValueChange(null);
    setDraft(undefined);
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) setDraft(selectedRange);
    setOpen(nextOpen);
  }

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        "date-range-picker-trigger justify-between gap-2 font-normal",
        className,
      )}
    />
  );
  const triggerContent = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <CalendarDays className="size-4 text-[var(--primary)]" aria-hidden="true" />
        <span className="tabular-nums">
          {value ? formatRange(value) : "Tất cả thời gian"}
        </span>
      </span>
      <ChevronDown className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
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
        elevation="flat"
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <Calendar
          mode="range"
          selected={draft}
          defaultMonth={
            draft?.to ?? draft?.from ?? selectedRange?.to ?? new Date()
          }
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
          className="px-3 pt-3 pb-2 [--cell-radius:0.5rem] [--cell-size:2.15rem]"
        />
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 text-xs"
          aria-live="polite"
        >
          <div className="min-w-0">
            <span className="block text-[11px] text-[var(--text-muted)]">Từ ngày</span>
            <strong className="block font-semibold text-[var(--foreground)] tabular-nums">
              {formatDraftDate(draft?.from)}
            </strong>
          </div>
          <span className="text-[var(--text-muted)]" aria-hidden="true">→</span>
          <div className="min-w-0 text-right">
            <span className="block text-[11px] text-[var(--text-muted)]">Đến ngày</span>
            <strong className="block font-semibold text-[var(--foreground)] tabular-nums">
              {formatDraftDate(draft?.to)}
            </strong>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
          {allowClear && value ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Mặc định
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelSelection}>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { DateRangePickerProps };
