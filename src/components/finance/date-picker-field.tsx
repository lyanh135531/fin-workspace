"use client";

import { Button } from "@/components/base";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MonthPicker({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const [year, month] = value.split("-").map(Number);
  const selected = new Date(year, month - 1, 1);
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="unstyled" size="auto" type="button" className="finance-month-trigger" aria-label="Chọn tháng báo cáo" />}
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
