import { ArrowRight, Lock, User } from "lucide-react";

import { AuthShowcase } from "@/components/auth-showcase";
import { FinLogo } from "@/components/fin-logo";

import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";
import { Loading } from "./loading";
import { PageContainer } from "./page-container";
import { Skeleton } from "./skeleton";

function PageHeaderSkeleton({
  hasActions = true,
  hasEyebrow = false,
  border = true,
}: {
  hasActions?: boolean;
  hasEyebrow?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between ${
        border ? "border-b border-[var(--border)] pb-4 md:pb-5" : ""
      }`}
    >
      <div className="space-y-1.5">
        {hasEyebrow ? <Skeleton className="h-3 w-28" /> : null}
        <Skeleton className="h-6 w-48 md:h-7 md:w-56" />
        <Skeleton className="h-3.5 w-[min(32rem,82vw)]" />
      </div>
      {hasActions ? (
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="size-9 rounded-xl" />
        </div>
      ) : null}
    </div>
  );
}

function OverviewLinePlotSkeleton() {
  return (
    <div className="relative h-60 md:h-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4">
      <div className="absolute inset-x-4 top-6 border-t border-dashed border-[var(--border)]" />
      <div className="absolute inset-x-4 top-[38%] border-t border-dashed border-[var(--border)]" />
      <div className="absolute inset-x-4 top-[68%] border-t border-dashed border-[var(--border)]" />
      <div className="absolute inset-x-4 bottom-9 border-t border-[var(--border)]" />
      <div className="absolute inset-x-6 bottom-9 top-8 flex items-end justify-between gap-2 md:gap-4">
        {[48, 65, 38, 78, 56, 84, 62, 72].map((height, index) => (
          <div
            key={index}
            className="flex flex-1 items-end justify-center gap-1 md:gap-1.5 h-full"
          >
            <Skeleton
              className="w-full max-w-5 rounded-t-md"
              style={{ height: `${height}%` }}
            />
            <Skeleton
              className="hidden sm:block w-full max-w-5 rounded-t-md opacity-70"
              style={{ height: `${Math.max(24, height - 18)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-6 bottom-2.5 flex justify-between">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton className="h-2.5 w-8" key={index} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 1. SỔ GIAO DỊCH (DASHBOARD / LEDGER) — Mobile / Tablet / Desktop
 * ========================================================================== */
function DashboardPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="flex w-full flex-col gap-3.5 md:gap-4"
        aria-busy="true"
        aria-label="Đang tải sổ giao dịch"
      >
        {/* CARD 1: HERO SUMMARY STRIP */}
        <Card as="section" className="gap-0 p-4 md:p-5">
          {/* Mobile View (< 768px): Compact Hero */}
          <div className="md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-28 rounded-lg" />
            </div>
            <Skeleton className="mt-2 h-8 w-44" />
            <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>

          {/* Tablet & Desktop View (md+): Luxury Executive Header + 3-Col KPI Strip */}
          <div className="hidden md:block">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3.5 w-80 max-w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-28 rounded-lg" />
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-5 divide-x divide-[var(--border)]">
              {[0, 1, 2].map((col) => (
                <div key={col} className={col > 0 ? "pl-5" : ""}>
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton
                      className={
                        col < 2
                          ? "size-7 rounded-lg"
                          : "h-5 w-16 rounded-md"
                      }
                    />
                  </div>
                  <Skeleton className="mt-2 h-7 w-36 lg:h-8 lg:w-44" />
                  <Skeleton className="mt-1.5 h-3 w-40 max-w-full" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* CARD 2: TRANSACTION LEDGER WORKSPACE */}
        <Card as="section" className="gap-0 overflow-hidden p-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-2.5 border-b border-[var(--border)] p-3.5 md:px-5 md:py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search bar */}
              <Skeleton className="h-9 min-w-[12rem] flex-1 rounded-xl md:max-w-xs" />

              {/* Desktop inline filters (lg+) */}
              <div className="hidden items-center gap-2 lg:flex">
                <Skeleton className="h-9 w-36 rounded-xl" />
                <Skeleton className="h-9 w-40 rounded-xl" />
                <Skeleton className="h-9 w-44 rounded-xl" />
                <Skeleton className="h-9 w-44 rounded-xl" />
              </div>

              {/* Mobile & Tablet filter trigger (< 1024px) */}
              <Skeleton className="size-9 shrink-0 rounded-xl lg:hidden" />

              {/* Right CTA button */}
              <div className="ml-auto flex items-center gap-2">
                <Skeleton className="hidden size-9 rounded-xl md:inline-flex lg:hidden" />
                <Skeleton className="hidden h-9 w-36 rounded-xl lg:inline-flex" />
              </div>
            </div>

            {/* Mobile & Tablet Segmented Type Bar (< 1024px) */}
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 lg:hidden">
              {[0, 1, 2, 3].map((tab) => (
                <Skeleton key={tab} className="h-7 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Desktop 12-Col Table Header Strip (lg+) */}
          <div className="hidden border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 px-5 py-2.5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
            <div className="col-span-5 flex items-center gap-3">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="col-span-2">
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="col-span-3 flex justify-end pr-9">
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Date-Grouped Transaction List */}
          <div className="divide-y divide-[var(--border)]">
            {[0, 1].map((groupIndex) => (
              <div key={groupIndex}>
                {/* Date Group Header */}
                <div className="flex items-center justify-between gap-2 bg-[var(--surface-secondary)]/85 px-4 py-2 md:px-5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="hidden size-1.5 rounded-full md:inline-block" />
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>

                {/* Rows */}
                <div className="divide-y divide-[var(--border)]">
                  {Array.from(
                    { length: groupIndex === 0 ? 4 : 3 },
                    (_, rowIndex) => (
                      <div key={rowIndex}>
                        {/* Mobile & Tablet Row (< 1024px) */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5 lg:hidden">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Skeleton
                                className={
                                  rowIndex % 2 === 0
                                    ? "h-4 w-32"
                                    : "h-4 w-40"
                                }
                              />
                              <Skeleton className="h-3 w-28" />
                            </div>
                          </div>
                          <Skeleton className="h-4 w-24 shrink-0" />
                        </div>

                        {/* Desktop 12-Col Grid Row (lg+) */}
                        <div className="hidden px-5 py-3.5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                          <div className="col-span-5 flex min-w-0 items-center gap-3">
                            <Skeleton className="size-4 shrink-0 rounded" />
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Skeleton
                                className={
                                  rowIndex % 2 === 0
                                    ? "h-4 w-40"
                                    : "h-4 w-52"
                                }
                              />
                              <Skeleton className="h-3 w-28" />
                            </div>
                          </div>

                          <div className="col-span-2 min-w-0">
                            <Skeleton className="h-6 w-28 rounded-lg" />
                          </div>

                          <div className="col-span-2 min-w-0 space-y-1.5">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>

                          <div className="col-span-3 flex items-center justify-end gap-2.5">
                            <div className="space-y-1 text-right">
                              <Skeleton className="ml-auto h-4 w-28" />
                              <Skeleton className="ml-auto h-3 w-14" />
                            </div>
                            <Skeleton className="size-7 shrink-0 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          <footer className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 px-4 py-2.5 md:px-5">
            <Skeleton className="h-3.5 w-44" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
          </footer>
        </Card>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 2. TỔNG QUAN TÀI CHÍNH (OVERVIEW) — Mobile / Tablet / Desktop
 * ========================================================================== */
function OverviewPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="flex w-full flex-col gap-3.5 md:gap-4"
        aria-busy="true"
        aria-label="Đang tải tổng quan tài chính"
      >
        {/* SECTION 1: EXECUTIVE WEALTH HERO CARD */}
        <Card as="section" className="gap-0 overflow-hidden p-4 md:p-6">
          {/* Top row: Eyebrow + Compact Period Capsule */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>

          {/* Middle row: Net Worth + Quick Actions */}
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Skeleton className="h-8 w-52 sm:h-9 md:h-10 md:w-64" />
              {/* Liquidity sub-breakdown pills */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-28 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>

          {/* Bottom row: 4-Metric Cashflow & Pace Strip */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 lg:grid-cols-4 lg:gap-6">
            {[0, 1, 2, 3].map((metric) => (
              <div
                key={metric}
                className={
                  metric >= 2
                    ? "col-span-2 border-t border-[var(--border)] pt-3 sm:col-span-1 sm:border-t-0 sm:pt-0 lg:border-l lg:border-[var(--border)] lg:pl-6"
                    : metric === 1
                      ? "lg:border-l lg:border-[var(--border)] lg:pl-6"
                      : ""
                }
              >
                <div className="flex items-center justify-between gap-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="mt-1.5 h-6 w-32 md:h-7 md:w-36" />
                <Skeleton className="mt-2 h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>

        {/* SECTION 2: MAIN BENTO GRID (7 Cols Analytics + 5 Cols Accounts) */}
        <div className="grid grid-cols-1 gap-3.5 md:gap-4 lg:grid-cols-12">
          {/* LEFT 7 COLS: INTERACTIVE ANALYTICS */}
          <Card as="section" className="flex flex-col gap-0 p-4 md:p-5 lg:col-span-7">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 sm:w-60">
                <Skeleton className="h-7 rounded-lg" />
                <Skeleton className="h-7 rounded-lg" />
                <Skeleton className="h-7 rounded-lg" />
              </div>
            </div>
            <div className="mt-4 flex-1">
              <OverviewLinePlotSkeleton />
            </div>
          </Card>

          {/* RIGHT 5 COLS: UNIFIED WALLETS & CREDIT CARDS */}
          <Card as="section" className="flex flex-col gap-0 p-4 md:p-5 lg:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5">
                <Skeleton className="h-6 w-14 rounded-lg" />
                <Skeleton className="h-6 w-12 rounded-lg" />
                <Skeleton className="h-6 w-12 rounded-lg" />
              </div>
            </div>

            <div className="mt-3.5 flex-1 space-y-2.5">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/35 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Skeleton className="size-9 shrink-0 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <Skeleton className="ml-auto h-4 w-24" />
                      <Skeleton className="ml-auto h-2.5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* SECTION 3: BOTTOM BENTO GRID (6 Cols 6-Jars + 6 Cols Activity) */}
        <div className="grid grid-cols-1 gap-3.5 md:gap-4 lg:grid-cols-12">
          {/* LEFT 6 COLS: 6 JARS & FINANCIAL GOALS */}
          <Card as="section" className="flex flex-col gap-0 p-4 md:p-5 lg:col-span-6">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="size-8 rounded-xl" />
            </div>

            <div className="mt-3.5 space-y-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-12" />
                </div>
                <Skeleton className="mt-2 h-2 w-full rounded-full" />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((jar) => (
                  <div
                    key={jar}
                    className="space-y-2 rounded-xl border border-[var(--border)] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* RIGHT 6 COLS: RECENT & UPCOMING ACTIVITY */}
          <Card as="section" className="flex flex-col gap-0 p-4 md:p-5 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3.5">
              <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-0.5">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
              <Skeleton className="size-8 rounded-xl" />
            </div>

            <div className="mt-3 divide-y divide-[var(--border)]">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24 shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 3. VÍ TÀI CHÍNH (WALLETS) — Mobile / Tablet / Desktop
 * ========================================================================== */
function WalletsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-3.5 md:space-y-4"
        aria-busy="true"
        aria-label="Đang tải danh sách ví"
      >
        {/* CARD 1: TOP SUMMARY STRIP */}
        <Card as="section" className="gap-0 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
            <div className="min-w-0">
              {/* Mobile hero balance */}
              <div className="md:hidden">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-1.5 h-8 w-48" />
              </div>
              {/* Tablet & Desktop title */}
              <div className="hidden md:block space-y-1.5">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3.5 w-80 max-w-full" />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="size-8 rounded-xl md:size-9" />
              <Skeleton className="size-8 rounded-xl md:size-9" />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 md:mt-4 md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-32 md:h-7 md:w-40" />
            </div>
            <div className="space-y-1.5 md:pl-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-28 md:h-7 md:w-36" />
            </div>
            <div className="hidden space-y-1.5 md:block md:pl-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-40" />
            </div>
          </div>
        </Card>

        {/* SECTION 2: FILTER BAR & WALLETS GRID */}
        <section className="space-y-3">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 md:w-72">
              <Skeleton className="h-7 rounded-lg" />
              <Skeleton className="h-7 rounded-lg" />
              <Skeleton className="h-7 rounded-lg" />
            </div>
          </div>

          {/* 1 Col Mobile, 2 Cols Tablet (md:), 3 Cols Desktop (lg:) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Card
                key={index}
                as="article"
                className="flex flex-col justify-between gap-4 p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-7 w-44" />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
                  <div className="space-y-1">
                    <Skeleton className="h-2.5 w-20" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 4. THẺ TÍN DỤNG (CREDIT CARDS OVERVIEW, DETAIL & STATEMENT)
 * ========================================================================== */
function CreditCardsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-3.5 md:space-y-4"
        aria-busy="true"
        aria-label="Đang tải danh sách thẻ tín dụng"
      >
        {/* Top Summary Strip */}
        <Card as="section" className="gap-0 p-3.5 md:p-5">
          <div className="flex items-start justify-between gap-2 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
            <div>
              <div className="md:hidden">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-1.5 h-7 w-40" />
              </div>
              <div className="hidden md:block space-y-1.5">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3.5 w-80 max-w-full" />
              </div>
            </div>
            <Skeleton className="size-8 rounded-xl md:size-9" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-[var(--border)] pt-2.5 md:mt-4 md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
            <div className="hidden space-y-1.5 md:block">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-36" />
            </div>
            <div className="space-y-1.5 md:pl-5">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-5 w-28 md:h-7 md:w-36" />
            </div>
            <div className="space-y-1.5 md:pl-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-28 md:h-7 md:w-36" />
            </div>
          </div>
        </Card>

        {/* Luxury Credit Cards Grid (1 Col Mobile, 2 Cols Tablet/Desktop) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((cardIndex) => (
            <Card
              key={cardIndex}
              as="article"
              className="flex flex-col justify-between gap-4 overflow-hidden p-4 md:p-5"
            >
              {/* Luxury Virtual Card Plate Header */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-3.5 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-9 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-6 w-36 md:h-7 md:w-44" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Utilization Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>

              {/* Statement Status & Actions */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                <Skeleton className="h-4 w-36" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

function CreditCardDetailPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-4 md:space-y-5"
        aria-busy="true"
        aria-label="Đang tải chi tiết thẻ tín dụng"
      >
        {/* Top Navigation & Card Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-40 md:h-6 md:w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
        </div>

        {/* Mobile Summary Card (< 768px) */}
        <Card className="space-y-3.5 p-4 md:hidden">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-44" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </Card>

        {/* Tablet & Desktop 12-Col Executive Showcase (md+) */}
        <div className="hidden md:grid md:grid-cols-12 md:gap-4 lg:gap-5">
          {/* Left Plate (5 cols on md, 4 cols on lg) */}
          <Card className="flex flex-col justify-between gap-6 p-5 md:col-span-5 lg:col-span-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </Card>

          {/* Right KPI Bento (7 cols on md, 8 cols on lg) */}
          <div className="grid grid-cols-2 gap-4 md:col-span-7 lg:col-span-8">
            <Card className="space-y-2.5 p-4 lg:p-5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </Card>
            <Card className="space-y-2.5 p-4 lg:p-5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </Card>
            <Card className="col-span-2 flex items-center justify-between gap-4 p-4 lg:px-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
              <Skeleton className="h-6 w-28" />
            </Card>
          </div>
        </div>

        {/* Segmented Tabs + Activity List */}
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 md:w-80">
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>

        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5 md:px-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36 md:w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-24 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function CreditCardStatementPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-4 md:space-y-5"
        aria-busy="true"
        aria-label="Đang tải chi tiết sao kê thẻ tín dụng"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44 md:h-6 md:w-56" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>

        {/* Statement Summary Strip */}
        <Card className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 md:divide-x md:divide-[var(--border)]">
            {[0, 1, 2, 3].map((col) => (
              <div key={col} className={col > 0 ? "md:pl-5" : ""}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-6 w-32 md:h-7 md:w-36" />
                <Skeleton className="mt-1.5 h-2.5 w-20" />
              </div>
            ))}
          </div>
        </Card>

        {/* Statement Transactions List */}
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5 md:px-5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40 md:w-52" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-4 w-24 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 5. GIAO DỊCH ĐỊNH KỲ (RECURRING TRANSACTIONS) — Mobile / Tablet / Desktop
 * ========================================================================== */
function RecurringTransactionsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-3.5 md:space-y-4"
        aria-busy="true"
        aria-label="Đang tải giao dịch định kỳ"
      >
        {/* CARD 1: TOP SUMMARY STRIP */}
        <Card as="section" className="gap-0 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 md:items-center md:border-b md:border-[var(--border)] md:pb-4">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40 md:h-6 md:w-48" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-xl md:size-9" />
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 md:mt-4 md:grid-cols-3 md:gap-5 md:divide-x md:divide-[var(--border)] md:border-t-0 md:pt-0">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-28 md:h-7 md:w-36" />
            </div>
            <div className="space-y-1.5 md:pl-5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-5 w-28 md:h-7 md:w-36" />
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-[var(--border)] pt-2.5 md:col-span-1 md:block md:space-y-1.5 md:border-t-0 md:pl-5 md:pt-0">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-20 md:h-7 md:w-28" />
            </div>
          </div>
        </Card>

        {/* SECTION 2: FILTER BAR & SCHEDULE GRID */}
        <section className="space-y-3">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 md:w-72">
              <Skeleton className="h-7 rounded-lg" />
              <Skeleton className="h-7 rounded-lg" />
              <Skeleton className="h-7 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            {[0, 1, 2, 3].map((item) => (
              <Card
                key={item}
                as="article"
                className="flex flex-col justify-between gap-3.5 p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-28 shrink-0" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 6. KẾ HOẠCH TÀI CHÍNH & 6 HŨ (FINANCIAL PLANS) — Mobile / Tablet / Desktop
 * ========================================================================== */
function FinancialPlansPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-3.5 md:space-y-4"
        aria-busy="true"
        aria-label="Đang tải kế hoạch tài chính"
      >
        {/* CARD 1: UNIFIED EXECUTIVE PLAN HERO CARD */}
        <Card as="section" className="space-y-4 p-4 md:p-5">
          {/* Top Bar: Badges on left + Sleek Icon Cluster on right */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="size-8 rounded-xl" />
            </div>
          </div>

          {/* Plan Title & Master Savings Progress */}
          <div className="space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-48 md:h-7 md:w-64" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <div className="space-y-1 sm:text-right">
                <Skeleton className="h-3 w-28 sm:ml-auto" />
                <Skeleton className="h-6 w-44 sm:ml-auto" />
              </div>
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>

          {/* 2x2 Mobile / 4-Col Desktop Cashflow & Budget Matrix */}
          <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--border)] pt-3.5 lg:grid-cols-4 lg:gap-3.5">
            {[0, 1, 2, 3].map((tile) => (
              <div
                key={tile}
                className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 p-3"
              >
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-32 md:h-6 md:w-36" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>
        </Card>

        {/* FULL-WIDTH 3-COLUMN SEGMENTED NAVIGATION BAR */}
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>

        {/* 6 JARS GRID (1 Col Mobile, 2 Cols Tablet, 3 Cols Desktop) */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((jar) => (
            <Card
              key={jar}
              as="article"
              className="flex flex-col justify-between gap-3.5 p-4 md:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 7. CÀI ĐẶT NHÓM & CÁ NHÂN (WORKSPACE & PERSONAL SETTINGS)
 * ========================================================================== */
function WorkspaceSettingsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-4 md:space-y-5"
        aria-busy="true"
        aria-label="Đang tải cài đặt nhóm tài chính"
      >
        {/* Mobile Invite Code Card (< 768px) */}
        <Card className="flex items-center justify-between gap-3 p-3.5 md:hidden">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </Card>

        {/* Tablet & Desktop Header with Compact Invite Card (md+) */}
        <div className="hidden md:flex md:items-start md:justify-between md:gap-6 md:border-b md:border-[var(--border)] md:pb-5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
        </div>

        {/* 3-Tab Navigation Bar */}
        <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>

        {/* Settings Content Card */}
        <Card as="section" className="space-y-5 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>

          <div className="flex justify-end border-t border-[var(--border)] pt-4">
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </Card>

        {/* Secondary Action / Danger Card */}
        <Card as="section" className="p-4 md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-80 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-36 shrink-0 rounded-xl" />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function PersonalSettingsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-4 md:space-y-5"
        aria-busy="true"
        aria-label="Đang tải cài đặt cá nhân"
      >
        <PageHeaderSkeleton hasEyebrow hasActions={false} />

        {/* Appearance / Theme Card */}
        <Card as="section" className="space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((theme) => (
              <div
                key={theme}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] p-3"
              >
                <div className="flex gap-1">
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="size-3 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </Card>

        {/* Categories / Preferences Card */}
        <Card as="section" className="space-y-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
            <Skeleton className="size-9 rounded-xl" />
          </div>

          <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 md:w-64">
            <Skeleton className="h-8 rounded-lg" />
            <Skeleton className="h-8 rounded-lg" />
          </div>

          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 8. THAM GIA NHÓM, TẠO NHÓM & TÀI KHOẢN THÀNH VIÊN
 * ========================================================================== */
function JoinPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-5"
        aria-busy="true"
        aria-label="Đang tải trang tham gia nhóm tài chính"
      >
        <PageHeaderSkeleton hasActions={false} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="space-y-4 lg:col-span-7">
            <Card className="space-y-4 p-4 md:p-6">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </Card>
            <Card className="space-y-2 p-4 md:p-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </Card>
          </div>
          <Card className="space-y-4 p-4 md:p-6 lg:col-span-5">
            <Skeleton className="h-5 w-40" />
            <div className="divide-y divide-[var(--border)]">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function WorkspaceFormPageSkeleton() {
  return (
    <PageContainer className="workspace-create-shell">
      <div
        className="workspace-create-page workspace-create-skeleton"
        aria-busy="true"
        aria-label="Đang tải biểu mẫu tạo nhóm tài chính"
      >
        <div className="workspace-create-layout">
          <div className="workspace-create-intro">
            <Skeleton className="h-7 w-44 rounded-lg" />
            <div className="mt-6 space-y-3 md:mt-10">
              <Skeleton className="h-12 w-full max-w-md rounded-lg md:h-16" />
              <Skeleton className="h-12 w-4/5 max-w-sm rounded-lg md:h-16" />
              <Skeleton className="h-4 w-full max-w-sm rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-52 w-full rounded-2xl md:mt-10 md:h-64" />
          </div>
          <Card className="space-y-5 p-5 md:p-6">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function MemberAccountsPageSkeleton() {
  return (
    <PageContainer>
      <div
        className="space-y-5"
        aria-busy="true"
        aria-label="Đang tải biểu mẫu tài khoản thành viên"
      >
        <PageHeaderSkeleton hasActions={false} />
        <Card className="space-y-4 p-4 md:p-6">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </Card>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 9. SYSTEM ADMIN PORTAL SKELETONS — Mobile / Tablet / Desktop
 * ========================================================================== */
function PortalDashboardPageSkeleton() {
  return (
    <PageContainer className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label="Đang tải tổng quan hệ thống"
      >
        <PageHeaderSkeleton hasActions={false} border={false} />

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((stat) => (
            <Card key={stat} size="sm" className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="size-8 shrink-0 rounded-lg" />
              </div>
              <Skeleton className="mt-2 h-7 w-20" />
            </Card>
          ))}
        </div>

        {/* 2 Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4 md:p-5">
            <Skeleton className="h-4 w-44" />
            <OverviewLinePlotSkeleton />
          </Card>
          <Card className="space-y-3 p-4 md:p-5">
            <Skeleton className="h-4 w-44" />
            <OverviewLinePlotSkeleton />
          </Card>
        </div>

        {/* Top 10 Active Users & Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-4 py-3.5 md:px-5">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-1.5 h-3 w-36" />
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 px-4 py-3 md:px-5"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-6 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-2.5 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5 md:px-5">
              <div className="space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
                >
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function PortalTablePageSkeleton({ label = "Đang tải dữ liệu hệ thống" }: { label?: string }) {
  return (
    <PageContainer className="flex flex-1 min-h-0 flex-col h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-1 min-h-0 flex-col gap-5" aria-busy="true" aria-label={label}>
        <PageHeaderSkeleton hasActions={false} />
        <Card className="flex flex-1 min-h-0 flex-col gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border)] p-4 md:p-5">
            <Skeleton className="h-9 flex-1 min-w-[12rem] rounded-xl md:max-w-xs" />
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36 md:w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="hidden h-5 w-24 rounded-full md:inline-flex" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function PortalUserDetailPageSkeleton() {
  return (
    <PageContainer className="flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label="Đang tải thông tin người dùng"
      >
        <PageHeaderSkeleton hasActions />
        <Card className="space-y-4 p-4 md:p-6">
          <div className="border-b border-[var(--border)] pb-3.5 space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2, 3].map((field) => (
              <div
                key={field}
                className="flex flex-col gap-1.5 py-3.5 md:flex-row md:items-center md:justify-between"
              >
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-3.5 md:px-5">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
              >
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

/* ============================================================================
 * 10. AUTHENTICATION SKELETON
 * ========================================================================== */
function AuthPageSkeleton({
  mode = "sign-in",
}: {
  mode?: "sign-in" | "register";
}) {
  const isSignIn = mode === "sign-in";

  return (
    <main
      className="auth-split-shell auth-mobile-polished-shell [&_.auth-fields>*]:!animate-none [&_.auth-form-actions]:!animate-none [&_.auth-form-panel]:!animate-none [&_.auth-visual-body]:!animate-none [&_.auth-visual-brand]:!animate-none [&_.auth-visual-footer]:!animate-none [&_.auth-visual-panel]:!animate-none"
      aria-busy="true"
      aria-label={isSignIn ? "Đang mở trang đăng nhập" : "Đang mở trang đăng ký"}
    >
      <AuthShowcase mode={mode} />

      <section className="auth-form-panel" aria-labelledby="auth-loading-title">
        <div className="auth-form-toolbar">
          <div className="auth-mobile-brand" aria-hidden>
            <FinLogo size={28} />
            <span>Felix</span>
          </div>
          <span className="size-10" aria-hidden />
        </div>

        <Card className="auth-form-card gap-0 py-0">
          <div className="auth-form-inner">
            <div className="auth-form-header">
              <span className="auth-form-eyebrow">
                {isSignIn ? "Đăng nhập" : "Đăng ký"}
              </span>
              <h2 id="auth-loading-title" className="auth-form-title">
                {isSignIn ? "Đăng nhập vào Felix" : "Tạo tài khoản Felix"}
              </h2>
              <p className="auth-form-subtitle">
                {isSignIn
                  ? "Xem lại ví, giao dịch và ngân sách của bạn."
                  : "Chọn tên đăng nhập và mật khẩu để bắt đầu."}
              </p>
            </div>

            <div className="auth-fields" aria-hidden>
              <div className="auth-floating-field">
                <Input
                  label="Tên đăng nhập"
                  type="text"
                  disabled
                  placeholder="Tên đăng nhập"
                  className="auth-field-input"
                  controlClassName="auth-field-wrap has-left-icon"
                  startAdornment={
                    <span className="auth-field-left-icon">
                      <User size={16} strokeWidth={2} />
                    </span>
                  }
                />
              </div>

              <div className="auth-floating-field">
                <Input
                  label="Mật khẩu"
                  type="password"
                  disabled
                  placeholder={isSignIn ? "Mật khẩu" : "Tối thiểu 8 ký tự"}
                  className="auth-field-input has-icon"
                  controlClassName="auth-field-wrap has-left-icon"
                  startAdornment={
                    <span className="auth-field-left-icon">
                      <Lock size={16} strokeWidth={2} />
                    </span>
                  }
                />
              </div>
            </div>

            <div className="auth-form-actions">
              <Button
                type="button"
                size="lg"
                className="auth-submit-btn is-loading"
                disabled
              >
                <Loading label="Đang mở trang..." />
                <span className="auth-submit-icon" aria-hidden>
                  <ArrowRight size={16} />
                </span>
              </Button>

              <p className="auth-form-link-row">
                {isSignIn ? (
                  <>
                    Chưa dùng Felix? <span>Đăng ký</span>
                  </>
                ) : (
                  <>
                    Đã có tài khoản? <span>Đăng nhập</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>

        <p className="auth-legal">
          {isSignIn
            ? "Dữ liệu của mỗi nhóm tài chính được lưu tách biệt."
            : "Sau khi đăng ký, bạn sẽ tạo nhóm tài chính đầu tiên."}
        </p>
      </section>
    </main>
  );
}

export {
  AuthPageSkeleton,
  CreditCardDetailPageSkeleton,
  CreditCardsPageSkeleton,
  CreditCardStatementPageSkeleton,
  DashboardPageSkeleton,
  FinancialPlansPageSkeleton,
  JoinPageSkeleton,
  MemberAccountsPageSkeleton,
  OverviewPageSkeleton,
  PersonalSettingsPageSkeleton,
  PortalDashboardPageSkeleton,
  PortalTablePageSkeleton,
  PortalUserDetailPageSkeleton,
  RecurringTransactionsPageSkeleton,
  WalletsPageSkeleton,
  WorkspaceFormPageSkeleton,
  WorkspaceSettingsPageSkeleton,
};
