"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button, DateRangePicker, Search } from "@/components/base";
import type { DateRangeValue } from "@/components/base";

type PortalActivityFiltersProps = {
  q: string;
  dateFrom?: string;
  dateTo?: string;
};

export function PortalActivityFilters({
  q,
  dateFrom,
  dateTo,
}: PortalActivityFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(q);
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(() =>
    dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
  );

  // Debounced search on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue.trim() === q.trim()) return;

      const params = new URLSearchParams(searchParams.toString());
      if (searchValue.trim()) {
        params.set("q", searchValue.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.push(query ? `/portal/activity?${query}` : "/portal/activity");
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, q, router, searchParams]);

  function handleDateRangeChange(value: DateRangeValue | null) {
    setDateRange(value);
    const params = new URLSearchParams(searchParams.toString());

    if (value?.from) {
      params.set("dateFrom", value.from);
    } else {
      params.delete("dateFrom");
    }

    if (value?.to) {
      params.set("dateTo", value.to);
    } else {
      params.delete("dateTo");
    }

    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/portal/activity?${query}` : "/portal/activity");
    });
  }

  const hasFilters = Boolean(q) || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
        <Search
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Tìm theo tên đăng nhập..."
          aria-label="Tìm hoạt động theo tên đăng nhập"
          containerClassName="w-full md:w-72"
        />

        <DateRangePicker
          value={dateRange}
          onValueChange={handleDateRangeChange}
          allowClear
          ariaLabel="Lọc theo khoảng thời gian"
          className="w-full md:w-auto"
        />
      </div>

      {hasFilters && (
        <Button
          variant="icon"
          size="icon"
          title="Xóa lọc"
          aria-label="Xóa lọc"
          render={<Link href="/portal/activity" aria-label="Xóa lọc" title="Xóa lọc" />}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
