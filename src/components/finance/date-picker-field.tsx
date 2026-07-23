"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

function fromIsoDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function DatePickerField({
  name,
  label,
  defaultValue = new Date(),
  value,
  onValueChange,
  required = false,
  allowClear = false,
  minDate,
  className,
}: {
  name?: string;
  label: string;
  defaultValue?: Date;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  allowClear?: boolean;
  minDate?: string;
  className?: string;
}) {
  const [internalDate, setInternalDate] = useState<Date | undefined>(defaultValue);
  const controlled = value !== undefined;
  const date = controlled ? fromIsoDate(value) : internalDate;

  function selectDate(nextDate: Date | undefined) {
    if (!controlled) setInternalDate(nextDate);
    onValueChange?.(nextDate ? toIsoDate(nextDate) : "");
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={cn("finance-date-trigger", className)} aria-label={label} />
        }
      >
        <CalendarDays size={16} />
        <span>{date ? format(date, "dd/MM/yyyy", { locale: vi }) : "Chọn ngày"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="finance-calendar-popover">
        <Calendar
          mode="single"
          required={required}
          selected={date}
          defaultMonth={date ?? fromIsoDate(minDate)}
          onSelect={selectDate}
          disabled={minDate ? { before: fromIsoDate(minDate)! } : undefined}
          locale={vi}
          autoFocus
        />
        {allowClear && date && (
          <button type="button" className="finance-calendar-clear" onClick={() => selectDate(undefined)}>
            <X size={14} /> Bỏ ngày đã chọn
          </button>
        )}
      </PopoverContent>
      {name && <input type="hidden" name={name} value={date ? toIsoDate(date) : ""} required={required} />}
    </Popover>
  );
}

export function MonthPicker({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const [year, month] = value.split("-").map(Number);
  const selected = new Date(year, month - 1, 1);
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" className="finance-month-trigger" aria-label="Chọn tháng báo cáo" />}
      >
        <CalendarDays size={16} />
        <span>{format(selected, "MM/yyyy", { locale: vi })}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="finance-calendar-popover">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => date && onValueChange(format(date, "yyyy-MM"))}
          captionLayout="dropdown"
          startMonth={new Date(2020, 0)}
          endMonth={new Date(new Date().getFullYear() + 1, 11)}
          locale={vi}
          autoFocus
        />
        <p className="finance-calendar-hint">Chọn một ngày bất kỳ trong tháng cần xem.</p>
      </PopoverContent>
    </Popover>
  );
}
