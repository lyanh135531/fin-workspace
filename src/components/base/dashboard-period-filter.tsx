"use client";

import { Select } from "./select";

const dashboardPeriodOptions = [
  { value: "month", label: "Tháng" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
] as const;

export type DashboardPeriod = (typeof dashboardPeriodOptions)[number]["value"];

export type DashboardPeriodFilterProps = {
  value: DashboardPeriod;
  onValueChange: (value: DashboardPeriod) => void;
  ariaLabel?: string;
};

export function DashboardPeriodFilter({
  value,
  onValueChange,
  ariaLabel = "Chọn kỳ dữ liệu",
}: DashboardPeriodFilterProps) {
  return (
    <div className="w-[6.75rem] shrink-0">
      <Select
        value={value}
        onValueChange={(nextValue) =>
          onValueChange(nextValue as DashboardPeriod)
        }
        ariaLabel={ariaLabel}
        options={[...dashboardPeriodOptions]}
        size="sm"
      />
    </div>
  );
}
