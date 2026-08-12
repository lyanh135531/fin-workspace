"use client";

import { ChevronDown, Funnel, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Button,
  CategoryTreeSelect,
  MonthRangePicker,
  type DateRangeValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from "@/components/base";

type FilterValues = {
  walletId: string;
  categoryId: string;
  memberId: string;
  type: string;
};

type OverviewFiltersProps = {
  wallets: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    parentId: string | null;
    type: "income" | "expense";
  }[];
  members: { id: string; name: string }[];
  values: FilterValues;
  dateRange: DateRangeValue;
  defaultDateRange: DateRangeValue;
  onWalletChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMemberChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onDateRangeChange: (value: DateRangeValue) => void;
  onReset: () => void;
};

export function OverviewFilters({
  wallets,
  categories,
  members,
  values,
  dateRange,
  defaultDateRange,
  onWalletChange,
  onCategoryChange,
  onMemberChange,
  onTypeChange,
  onDateRangeChange,
  onReset,
}: OverviewFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.values(values).filter(
    (value) => value !== "all",
  ).length;
  const hasActiveFilters = activeFilterCount > 0;
  const hasCustomDateRange =
    dateRange.from !== defaultDateRange.from ||
    dateRange.to !== defaultDateRange.to;
  const hasResettableState = hasActiveFilters || hasCustomDateRange;

  return (
    <section className="overview-filter-toolbar" aria-label="Bộ lọc báo cáo">
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={`overview-filter-trigger border border-input shadow-none transition-colors hover:bg-white outline-none select-none bg-white ${hasActiveFilters ? "is-active" : ""}`}
              aria-label="Mở bộ lọc báo cáo"
            />
          }
        >
          <Funnel aria-hidden="true" />
          <span>Bộ lọc</span>
          {hasActiveFilters && (
            <span
              className="overview-filter-count"
              aria-label={`${activeFilterCount} bộ lọc đang áp dụng`}
            >
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className="overview-filter-chevron"
            aria-hidden="true"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="overview-filter-popover"
        >
          <div className="overview-popover-filter-grid">
            <FilterField label="Ví">
              <Select
                value={values.walletId}
                onValueChange={onWalletChange}
                ariaLabel="Lọc theo ví"
                options={[
                  { value: "all", label: "Tất cả ví" },
                  ...wallets.map((wallet) => ({
                    value: wallet.id,
                    label: wallet.name,
                  })),
                ]}
              />
            </FilterField>
            <FilterField label="Hạng mục">
              <CategoryTreeSelect
                value={values.categoryId}
                onValueChange={onCategoryChange}
                ariaLabel="Lọc theo hạng mục"
                categories={categories}
                emptyOption={{ value: "all", label: "Tất cả hạng mục" }}
              />
            </FilterField>
            <FilterField label="Loại giao dịch">
              <Select
                value={values.type}
                onValueChange={onTypeChange}
                ariaLabel="Lọc theo loại giao dịch"
                options={[
                  { value: "all", label: "Tất cả loại" },
                  { value: "income", label: "Thu nhập" },
                  { value: "expense", label: "Chi phí" },
                  { value: "transfer", label: "Chuyển khoản" },
                ]}
              />
            </FilterField>
            <FilterField label="Thành viên">
              <Select
                value={values.memberId}
                onValueChange={onMemberChange}
                ariaLabel="Lọc theo thành viên"
                options={[
                  { value: "all", label: "Tất cả thành viên" },
                  ...members.map((member) => ({
                    value: member.id,
                    label: member.name,
                  })),
                ]}
              />
            </FilterField>
          </div>
          <footer className="overview-filter-popover-footer">
            <span>Thay đổi được áp dụng ngay</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onReset}
              disabled={!hasResettableState}
              className="overview-filter-reset"
            >
              <RefreshCw aria-hidden="true" />
              Đặt lại tất cả
            </Button>
          </footer>
        </PopoverContent>
      </Popover>
      <MonthRangePicker
        value={dateRange}
        onValueChange={onDateRangeChange}
        ariaLabel="Chọn khoảng tháng báo cáo"
        className={`overview-date-range-trigger ${hasCustomDateRange ? "is-custom" : ""}`}
      />
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="overview-popover-filter-field"
      role="group"
      aria-label={label}
    >
      <span>{label}</span>
      {children}
    </div>
  );
}

export type { FilterValues, OverviewFiltersProps };
