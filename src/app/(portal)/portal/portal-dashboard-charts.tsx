"use client";

import { Card } from "@/components/base";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type RegistrationData = { month: string; count: number };
type ActivityData = { day: string; count: number };
type DauData = { day: string; dau: number };

type Props = {
  registrations: RegistrationData[];
  activityByDay: ActivityData[];
  dau: DauData[];
};

const registrationConfig: ChartConfig = {
  count: {
    label: "Đăng ký mới",
    color: "var(--primary)",
  },
};

const activityConfig: ChartConfig = {
  count: {
    label: "Thao tác",
    color: "var(--primary)",
  },
  dau: {
    label: "User hoạt động (DAU)",
    color: "var(--success)",
  },
};

function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  return `T${month}/${year}`;
}

function formatDay(value: string): string {
  const parts = value.split("-");
  return `${parts[2]}/${parts[1]}`;
}

export function PortalDashboardCharts({
  registrations,
  activityByDay,
  dau,
}: Props) {
  const mergedActivity = activityByDay.map((item) => {
    const dauEntry = dau.find((d) => d.day === item.day);
    return {
      day: item.day,
      count: item.count,
      dau: dauEntry?.dau ?? 0,
    };
  });

  for (const dauEntry of dau) {
    if (!mergedActivity.some((m) => m.day === dauEntry.day)) {
      mergedActivity.push({
        day: dauEntry.day,
        count: 0,
        dau: dauEntry.dau,
      });
    }
  }
  mergedActivity.sort((a, b) => a.day.localeCompare(b.day));

  return (
    <>
      {/* Registration by Month */}
      <Card className="gap-0 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              Đăng ký theo tháng
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              12 tháng gần nhất
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="size-2 rounded-full bg-[var(--primary)]" aria-hidden />
            <span>Tài khoản mới</span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {registrations.length === 0 ? (
            <div className="grid min-h-40 place-items-center text-sm text-[var(--text-muted)]">
              Chưa có dữ liệu đăng ký.
            </div>
          ) : (
            <ChartContainer config={registrationConfig} className="h-56 w-full">
              <BarChart data={registrations} accessibilityLayer>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={formatMonth}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(label) => formatMonth(String(label))}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </Card>

      {/* System Activity + DAU by Day */}
      <Card className="gap-0 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              Hoạt động hệ thống
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              30 ngày gần nhất · Thao tác & Người dùng hoạt động
            </p>
          </div>
          <div className="hidden flex-wrap items-center gap-3 text-xs sm:flex">
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="size-2 rounded-full bg-[var(--primary)]" aria-hidden />
              Thao tác
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="size-2 rounded-full bg-[var(--success)]" aria-hidden />
              User hoạt động (DAU)
            </span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {mergedActivity.length === 0 ? (
            <div className="grid min-h-40 place-items-center text-sm text-[var(--text-muted)]">
              Chưa có dữ liệu hoạt động.
            </div>
          ) : (
            <ChartContainer config={activityConfig} className="h-56 w-full">
              <ComposedChart data={mergedActivity} accessibilityLayer>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={formatDay}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(label) => formatDay(String(label))}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  fill="url(#activityGradient)"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="dau"
                  stroke="var(--color-dau)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>
      </Card>
    </>
  );
}
