"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Matcher } from "react-day-picker";

import { Button } from "@/components/base/button";
import { Label } from "@/components/base/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  id?: string;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (!ISO_DATE_PATTERN.test(value)) {
    throw new RangeError(`Invalid ISO date "${value}". Expected yyyy-MM-dd.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValidDate) {
    throw new RangeError(`Invalid calendar date "${value}".`);
  }

  return date;
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  id,
  name,
  label,
  ariaLabel,
  placeholder = "Chọn ngày",
  value,
  defaultValue,
  onValueChange,
  required = false,
  disabled = false,
  allowClear = false,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const generatedId = useId();
  const datePickerId = id ?? (label ? generatedId : undefined);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedDate = useMemo(
    () => parseIsoDate(currentValue),
    [currentValue],
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
  const disabledDates = useMemo<Matcher[]>(
    () => [
      ...(minimumDate ? [{ before: minimumDate }] : []),
      ...(maximumDate ? [{ after: maximumDate }] : []),
    ],
    [maximumDate, minimumDate],
  );

  function updateValue(nextDate: Date | undefined): void {
    const nextValue = nextDate ? toIsoDate(nextDate) : "";

    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  function selectDate(nextDate: Date | undefined): void {
    updateValue(nextDate);

    if (nextDate) {
      setOpen(false);
    }
  }

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={datePickerId}
            type="button"
            variant="outline"
            aria-label={ariaLabel ?? label}
            disabled={disabled}
            className={cn(
              "date-picker border border-input shadow-none hover:bg-transparent w-full justify-between px-3 font-normal tabular-nums bg-transparent dark:bg-input/30 dark:hover:bg-input/50",
              !selectedDate && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
          <span className="truncate">
            {selectedDate
              ? format(selectedDate, "dd/MM/yyyy", { locale: vi })
              : placeholder}
          </span>
        </span>
        <ChevronDown
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto gap-0 overflow-hidden p-0"
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={navigationStartMonth}
          endMonth={navigationEndMonth}
          reverseYears
          required={required}
          selected={selectedDate}
          defaultMonth={selectedDate ?? minimumDate ?? maximumDate}
          onSelect={selectDate}
          disabled={disabledDates.length > 0 ? disabledDates : undefined}
          locale={vi}
          formatters={{
            formatCaption: (month: Date): string =>
              format(month, "'Tháng' M, yyyy", { locale: vi }),
            formatMonthDropdown: (month: Date): string =>
              format(month, "'Tháng' M", { locale: vi }),
            formatWeekdayName: (day: Date): string =>
              day.getDay() === 0 ? "CN" : `T${day.getDay() + 1}`,
          }}
          autoFocus
          className="px-2.5 pt-2.5 pb-4 [--cell-radius:0.45rem] [--cell-size:2rem]"
        />

        {allowClear && selectedDate && (
          <div className="border-t border-border p-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-center text-xs text-muted-foreground"
              onClick={() => {
                updateValue(undefined);
                setOpen(false);
              }}
            >
              <X aria-hidden="true" />
              Xóa ngày
            </Button>
          </div>
        )}
      </PopoverContent>

      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required}
        />
      )}
    </Popover>
  );

  if (!label) return picker;

  return (
    <div className="grid gap-1">
      <Label required={required}>{label}</Label>
      {picker}
    </div>
  );
}
