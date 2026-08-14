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
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
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
  isMobile: boolean;
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
  isMobile,
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
    <section
      className={
        isMobile ? "overview-filter-toolbar" : "flex items-center gap-2"
      }
      aria-label="Bộ lọc báo cáo"
    >
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant={isMobile ? "outline" : "filter"}
              className={
                isMobile
                  ? `overview-filter-trigger border border-input shadow-none transition-colors hover:bg-white outline-none select-none bg-white ${hasActiveFilters ? "is-active" : ""}`
                  : undefined
              }
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
          <ChevronDown className="overview-filter-chevron" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          elevation={isMobile ? "raised" : "flat"}
          className={
            isMobile
              ? "overview-filter-popover"
              : "w-[39rem] max-w-[calc(100vw-2rem)]"
          }
        >
          {isMobile ? (
            <>
              <div className="overview-popover-filter-grid">
                <FilterField label="Ví" isMobile>
                  <WalletFilter
                    value={values.walletId}
                    wallets={wallets}
                    onValueChange={onWalletChange}
                  />
                </FilterField>
                <FilterField label="Hạng mục" isMobile>
                  <CategoryFilter
                    value={values.categoryId}
                    categories={categories}
                    onValueChange={onCategoryChange}
                    terminology="hạng mục"
                  />
                </FilterField>
                <FilterField label="Loại giao dịch" isMobile>
                  <TypeFilter
                    value={values.type}
                    onValueChange={onTypeChange}
                  />
                </FilterField>
                <FilterField label="Thành viên" isMobile>
                  <MemberFilter
                    value={values.memberId}
                    members={members}
                    onValueChange={onMemberChange}
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
            </>
          ) : (
            <>
              <PopoverHeader className="flex-row items-start gap-3 border-b border-[var(--border)] px-2 pb-4 pt-1">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
                  aria-hidden="true"
                >
                  <Funnel size={17} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <PopoverTitle className="text-sm font-semibold text-[var(--foreground)]">
                    Lọc dữ liệu tổng quan
                  </PopoverTitle>
                  <PopoverDescription className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Thu hẹp số liệu và biểu đồ theo phạm vi bạn cần xem.
                  </PopoverDescription>
                </div>
              </PopoverHeader>

              <div className="grid grid-cols-[1.15fr_0.85fr] px-2 py-3">
                <section
                  className="space-y-4 pr-5"
                  aria-labelledby="filter-scope-title"
                >
                  <div>
                    <h3
                      id="filter-scope-title"
                      className="text-xs font-semibold text-[var(--foreground)]"
                    >
                      Phạm vi dữ liệu
                    </h3>
                    <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                      Chọn nguồn tiền và danh mục cần phân tích.
                    </p>
                  </div>
                  <FilterField label="Ví" isMobile={false}>
                    <WalletFilter
                      value={values.walletId}
                      wallets={wallets}
                      onValueChange={onWalletChange}
                    />
                  </FilterField>
                  <FilterField label="Danh mục" isMobile={false}>
                    <CategoryFilter
                      value={values.categoryId}
                      categories={categories}
                      onValueChange={onCategoryChange}
                      terminology="danh mục"
                    />
                  </FilterField>
                </section>

                <section
                  className="space-y-4 border-l border-[var(--border)] pl-5"
                  aria-labelledby="filter-attribute-title"
                >
                  <div>
                    <h3
                      id="filter-attribute-title"
                      className="text-xs font-semibold text-[var(--foreground)]"
                    >
                      Thuộc tính giao dịch
                    </h3>
                    <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                      Lọc sâu theo loại và người thực hiện.
                    </p>
                  </div>
                  <FilterField label="Loại giao dịch" isMobile={false}>
                    <TypeFilter
                      value={values.type}
                      onValueChange={onTypeChange}
                    />
                  </FilterField>
                  <FilterField label="Thành viên" isMobile={false}>
                    <MemberFilter
                      value={values.memberId}
                      members={members}
                      onValueChange={onMemberChange}
                    />
                  </FilterField>
                </section>
              </div>

              <footer className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-2 pt-3">
                <span className="text-xs text-[var(--text-muted)]">
                  {hasResettableState
                    ? `${activeFilterCount + Number(hasCustomDateRange)} điều kiện đang áp dụng`
                    : "Đang hiển thị toàn bộ dữ liệu"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={onReset}
                    disabled={!hasResettableState}
                  >
                    <RefreshCw aria-hidden="true" />
                    Đặt lại
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Xong
                  </Button>
                </div>
              </footer>
            </>
          )}
        </PopoverContent>
      </Popover>
      <MonthRangePicker
        value={dateRange}
        onValueChange={onDateRangeChange}
        ariaLabel="Chọn khoảng tháng báo cáo"
        className={
          isMobile
            ? `overview-date-range-trigger ${hasCustomDateRange ? "is-custom" : ""}`
            : "w-[15rem]"
        }
      />
    </section>
  );
}

function WalletFilter({
  value,
  wallets,
  onValueChange,
}: {
  value: string;
  wallets: { id: string; name: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      ariaLabel="Lọc theo ví"
      options={[
        { value: "all", label: "Tất cả ví" },
        ...wallets.map((wallet) => ({
          value: wallet.id,
          label: wallet.name,
        })),
      ]}
    />
  );
}

function CategoryFilter({
  value,
  categories,
  onValueChange,
  terminology,
}: {
  value: string;
  categories: OverviewFiltersProps["categories"];
  onValueChange: (value: string) => void;
  terminology: "hạng mục" | "danh mục";
}) {
  return (
    <CategoryTreeSelect
      value={value}
      onValueChange={onValueChange}
      ariaLabel={`Lọc theo ${terminology}`}
      categories={categories}
      emptyOption={{ value: "all", label: `Tất cả ${terminology}` }}
    />
  );
}

function TypeFilter({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      ariaLabel="Lọc theo loại giao dịch"
      options={[
        { value: "all", label: "Tất cả loại" },
        { value: "income", label: "Thu nhập" },
        { value: "expense", label: "Chi phí" },
        { value: "transfer", label: "Chuyển khoản" },
      ]}
    />
  );
}

function MemberFilter({
  value,
  members,
  onValueChange,
}: {
  value: string;
  members: { id: string; name: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      ariaLabel="Lọc theo thành viên"
      options={[
        { value: "all", label: "Tất cả thành viên" },
        ...members.map((member) => ({
          value: member.id,
          label: member.name,
        })),
      ]}
    />
  );
}

function FilterField({
  label,
  children,
  isMobile,
}: {
  label: string;
  children: ReactNode;
  isMobile: boolean;
}) {
  return (
    <div
      className={isMobile ? "overview-popover-filter-field" : "space-y-1.5"}
      role="group"
      aria-label={label}
    >
      <span
        className={
          isMobile
            ? undefined
            : "text-xs font-medium text-[var(--text-secondary)]"
        }
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export type { FilterValues, OverviewFiltersProps };
