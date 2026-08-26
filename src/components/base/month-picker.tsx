"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/base/button";
import { Label } from "@/components/base/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type MonthPickerProps = {
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
  minMonth?: string;
  maxMonth?: string;
  className?: string;
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function parseMonth(value: string | undefined): { year: number; month: number } | undefined {
  if (!value) return undefined;

  const match = MONTH_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid month "${value}". Expected yyyy-MM.`);
  }

  return { year: Number(match[1]), month: Number(match[2]) };
}

function monthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatMonth(value: string): string {
  const parsed = parseMonth(value);
  return `Tháng ${parsed?.month}, ${parsed?.year}`;
}

export function MonthPicker({
  id,
  name,
  label,
  ariaLabel,
  placeholder = "Chọn tháng",
  value,
  defaultValue,
  onValueChange,
  required = false,
  disabled = false,
  minMonth,
  maxMonth,
  className,
}: MonthPickerProps) {
  const generatedId = useId();
  const monthPickerId = id ?? (label ? generatedId : undefined);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedMonth = useMemo(() => parseMonth(currentValue), [currentValue]);
  const minimumMonth = useMemo(() => parseMonth(minMonth), [minMonth]);
  const maximumMonth = useMemo(() => parseMonth(maxMonth), [maxMonth]);
  const minimumYear = minimumMonth?.year ?? (selectedMonth?.year ?? new Date().getFullYear()) - 50;
  const maximumYear = maximumMonth?.year ?? (selectedMonth?.year ?? new Date().getFullYear()) + 50;
  const [displayYear, setDisplayYear] = useState(
    selectedMonth?.year ?? minimumMonth?.year ?? maximumMonth?.year ?? new Date().getFullYear(),
  );

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      setDisplayYear(
        selectedMonth?.year ?? minimumMonth?.year ?? maximumMonth?.year ?? new Date().getFullYear(),
      );
    }
    setOpen(nextOpen);
  }

  function selectMonth(nextValue: string): void {
    if (!isControlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  }

  const picker = (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={monthPickerId}
            type="button"
            variant="filter"
            aria-label={ariaLabel ?? label}
            disabled={disabled}
            className={cn("w-full justify-between", className)}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
          <span className="truncate tabular-nums">
            {currentValue ? formatMonth(currentValue) : placeholder}
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
        elevation="flat"
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label="Năm trước"
            disabled={displayYear <= minimumYear}
            onClick={() => setDisplayYear((year) => year - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <strong className="text-sm font-semibold tabular-nums">
            Năm {displayYear}
          </strong>
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label="Năm sau"
            disabled={displayYear >= maximumYear}
            onClick={() => setDisplayYear((year) => year + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <div
          className="grid grid-cols-4 gap-1 p-3"
          aria-label={`Các tháng năm ${displayYear}`}
        >
          {MONTHS.map((month) => {
            const optionValue = monthValue(displayYear, month);
            const isSelected = optionValue === currentValue;
            const isDisabled =
              (minMonth ? optionValue < minMonth : false) ||
              (maxMonth ? optionValue > maxMonth : false);

            return (
              <Button
                key={optionValue}
                type="button"
                variant={isSelected ? "selected" : "ghost"}
                size="lg"
                aria-label={formatMonth(optionValue)}
                aria-pressed={isSelected}
                disabled={isDisabled}
                onClick={() => selectMonth(optionValue)}
              >
                Tháng {month}
              </Button>
            );
          })}
        </div>
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
      <Label htmlFor={monthPickerId} required={required}>
        {label}
      </Label>
      {picker}
    </div>
  );
}
