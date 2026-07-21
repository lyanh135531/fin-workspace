"use client";

import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const toIsoDate = (date: Date) => format(date, "yyyy-MM-dd");

export function DatePickerField({
  name,
  label,
  defaultValue = new Date(),
  required = false,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: Date;
  required?: boolean;
  className?: string;
}) {
  const [date, setDate] = useState<Date | undefined>(defaultValue);
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
          selected={date}
          onSelect={setDate}
          locale={vi}
          autoFocus
        />
      </PopoverContent>
      <input type="hidden" name={name} value={date ? toIsoDate(date) : ""} required={required} />
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
