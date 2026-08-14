import { Card } from "./card";
import { Skeleton } from "./skeleton";

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-[min(32rem,80vw)]" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

function LedgerDesktopRowSkeleton({ index }: { index: number }) {
  const widths = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"];
  return (
    <div className="ledger-skeleton-desktop-row">
      <Skeleton className="size-4" />
      <div className="grid gap-2">
        <Skeleton className={`h-3 ${widths[index % widths.length]}`} />
        <Skeleton className="h-2.5 w-12" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="ml-auto h-3 w-24" />
      <div className="flex justify-center gap-2">
        <Skeleton className="size-7" />
        <Skeleton className="size-7" />
      </div>
    </div>
  );
}

function LedgerDesktopGroupedRowSkeleton({ index }: { index: number }) {
  const descriptionWidths = ["w-28", "w-36", "w-24", "w-32"];
  return (
    <div className="grid min-h-[4.5rem] min-w-[67.5rem] grid-cols-[3rem_minmax(12rem,1.4fr)_7.5rem_8rem_7.5rem_9rem_minmax(9rem,0.8fr)_7rem] items-center border-b border-[var(--border)] px-5">
      <Skeleton className="size-4" />
      <div className="min-w-0">
        <Skeleton
          className={`h-3 ${descriptionWidths[index % descriptionWidths.length]}`}
        />
        <Skeleton className="mt-2 h-2.5 w-16" />
      </div>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="ml-auto h-3 w-24" />
      <div className="flex justify-end gap-1">
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
      </div>
    </div>
  );
}

function LedgerMobileRowSkeleton({ index }: { index: number }) {
  const widths = ["w-20", "w-24", "w-16", "w-28"];
  return (
    <div className="ledger-skeleton-mobile-row">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7" />
        <Skeleton className={`h-3 ${widths[index % widths.length]}`} />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function OverviewLinePlotSkeleton() {
  return (
    <div className="relative h-[19rem] overflow-hidden">
      <div className="absolute inset-x-0 top-5 border-t border-[var(--border)]" />
      <div className="absolute inset-x-0 top-[38%] border-t border-[var(--border)]" />
      <div className="absolute inset-x-0 top-[67%] border-t border-[var(--border)]" />
      <div className="absolute inset-x-0 bottom-7 border-t border-[var(--border)]" />
      <Skeleton className="absolute bottom-[32%] left-[7%] h-1 w-[18%] -rotate-12" />
      <Skeleton className="absolute bottom-[37%] left-[23%] h-1 w-[20%] rotate-6" />
      <Skeleton className="absolute bottom-[48%] left-[41%] h-1 w-[19%] -rotate-6" />
      <Skeleton className="absolute bottom-[45%] left-[58%] h-1 w-[18%] rotate-12" />
      <Skeleton className="absolute bottom-[60%] left-[74%] h-1 w-[18%] -rotate-6" />
      <div className="absolute inset-x-4 bottom-0 flex justify-between">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton className="h-2 w-8" key={index} />
        ))}
      </div>
    </div>
  );
}

function OverviewMemberPlotSkeleton() {
  return (
    <div className="space-y-4 pt-3">
      {["w-4/5", "w-3/5", "w-full", "w-2/3", "w-1/2"].map((width, index) => (
        <div
          className="grid grid-cols-[2.5rem_1fr] items-center gap-3"
          key={index}
        >
          <Skeleton className="h-2 w-8" />
          <Skeleton className={`h-3 ${width}`} />
        </div>
      ))}
      <div className="flex items-center gap-4 pt-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

function DashboardPageSkeleton() {
  return (
    <>
      <div className="h-full min-h-0 lg:hidden">
        <div
          className="ledger-page-shell ledger-page-skeleton"
          aria-busy="true"
          aria-label="Đang tải sổ giao dịch"
        >
          <header className="ledger-page-hero rounded-xl">
            <div className="ledger-page-intro">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-44" />
              <Skeleton className="mt-2 h-3.5 w-72" />
            </div>
            <div className="ledger-hero-balance ledger-skeleton-balance">
              <Skeleton className="ledger-skeleton-period h-3 w-24" />
              <Skeleton className="ledger-skeleton-amount h-6 w-36" />
            </div>
          </header>

          <div className="ledger-table-viewport">
            <section className="dashboard-ledger-card ledger-book ledger-skeleton-book">
              <div className="ledger-skeleton-toolbar">
                <Skeleton className="ledger-skeleton-search" />
                <Skeleton className="ledger-skeleton-filter" />
              </div>

              <div className="ledger-skeleton-desktop-table">
                <div className="ledger-skeleton-desktop-head">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} className="h-2.5 w-14" />
                  ))}
                </div>
                {Array.from({ length: 6 }, (_, index) => (
                  <LedgerDesktopRowSkeleton key={index} index={index} />
                ))}
              </div>

              <div className="ledger-skeleton-mobile-list">
                {[0, 1].map((group) => (
                  <div key={group}>
                    <div className="ledger-skeleton-date-heading">
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    {Array.from({ length: group === 0 ? 4 : 3 }, (_, index) => (
                      <LedgerMobileRowSkeleton
                        key={index}
                        index={group * 4 + index}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <footer className="ledger-skeleton-footer">
                <Skeleton className="h-2.5 w-20" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7" />
                  <Skeleton className="h-2.5 w-12" />
                  <Skeleton className="size-7" />
                </div>
              </footer>
            </section>
          </div>
        </div>
      </div>

      <div
        className="mx-auto hidden h-full min-h-0 w-full max-w-7xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden px-px py-2 lg:grid"
        aria-busy="true"
        aria-label="Đang tải sổ giao dịch"
      >
        <header className="border-b border-[var(--border)] mb-5 pb-5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-3.5 w-[min(36rem,62vw)]" />
        </header>

        <Card as="section" className="mb-5 gap-0">
          <div className="grid grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] items-stretch">
            <div className="pr-6">
              <div className="flex items-center gap-2">
                <Skeleton className="size-3.5" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="mt-3 h-6 w-40" />
              <div className="mt-2 flex items-center gap-2">
                <Skeleton className="size-3" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
            {[0, 1, 2].map((index) => (
              <div
                className="border-l border-[var(--border)] px-6 last:pr-0"
                key={index}
              >
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-5 w-28" />
                <Skeleton className="mt-2 h-2 w-24" />
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" className="min-h-0 gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-6 py-4">
            <Skeleton className="h-9 w-[22rem]" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mr-auto h-2.5 w-20" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="grid min-w-[67.5rem] grid-cols-[3rem_minmax(12rem,1.4fr)_7.5rem_8rem_7.5rem_9rem_minmax(9rem,0.8fr)_7rem] items-center border-b border-[var(--border)] px-5 py-3">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton className="h-2.5 w-12" key={index} />
              ))}
            </div>

            {[0, 1].map((groupIndex) => (
              <div key={groupIndex}>
                <div className="flex min-w-[67.5rem] items-center justify-between gap-6 bg-[var(--surface-secondary)] px-5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-3.5" />
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                  <div className="flex items-center gap-5">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                </div>
                {Array.from(
                  { length: groupIndex === 0 ? 3 : 2 },
                  (_, index) => (
                    <LedgerDesktopGroupedRowSkeleton
                      key={index}
                      index={groupIndex * 3 + index}
                    />
                  ),
                )}
              </div>
            ))}
          </div>

          <footer className="flex min-h-14 items-center justify-between gap-5 border-t border-[var(--border)] px-6 py-3">
            <Skeleton className="h-2.5 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-8" />
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="size-8" />
            </div>
          </footer>
        </Card>
      </div>
    </>
  );
}

function OverviewPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải tổng quan tài chính">
      <div className="mobile-page-skeleton overview-mobile-skeleton">
        <header className="overview-mobile-skeleton-page-header">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-2.5 w-64 max-w-[80vw]" />
        </header>

        <section className="overview-mobile-skeleton-balance">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="mt-4 h-8 w-48" />
          <Skeleton className="mt-3 h-2.5 w-36" />
          <div className="overview-mobile-skeleton-cashflow">
            {[0, 1].map((index) => (
              <div key={index}>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2 h-3.5 w-24 max-w-full" />
              </div>
            ))}
          </div>
        </section>

        <div className="overview-mobile-skeleton-filters">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        <div className="overview-mobile-skeleton-analysis-heading">
          <div>
            <Skeleton className="h-2 w-24" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <Skeleton className="h-2.5 w-20" />
        </div>

        <section className="overview-mobile-skeleton-category">
          <header>
            <div>
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-2 w-40" />
            </div>
            <Skeleton className="h-6 w-7 rounded-md" />
          </header>
          <div className="overview-mobile-skeleton-category-body">
            <Skeleton className="size-32 rounded-full" />
            <div>
              {[0, 1, 2].map((index) => (
                <div
                  className="overview-mobile-skeleton-category-row"
                  key={index}
                >
                  <Skeleton className="size-2.5 rounded-full" />
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="ml-auto h-2.5 w-10" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {[0, 1, 2].map((index) => (
          <section className="overview-mobile-skeleton-chart" key={index}>
            <header>
              <div>
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-2 h-2 w-28" />
              </div>
              <Skeleton className="h-6 w-12 rounded-md" />
            </header>
            <div className="overview-mobile-skeleton-plot">
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-px w-full" />
              <div>
                {[0, 1, 2, 3, 4, 5].map((barIndex) => (
                  <Skeleton
                    className="w-5 rounded-t-md"
                    key={barIndex}
                    style={{
                      height: `${24 + ((barIndex * 17 + index * 11) % 64)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="desktop-page-skeleton">
        <div className="mx-auto max-w-7xl space-y-5 pb-10 pt-2">
          <header className="flex items-start justify-between gap-8 border-b border-[var(--border)] pb-5">
            <div className="space-y-2">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-3.5 w-[min(38rem,58vw)]" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-60" />
            </div>
          </header>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Card
              as="article"
              tone="primarySoft"
              className="relative gap-0 lg:col-span-5"
            >
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-4 h-9 w-64 max-w-full" />
              <div className="mt-7 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-3.5" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-3.5" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
            </Card>

            <Card as="article" className="gap-0 lg:col-span-7">
              <header className="flex items-start justify-between gap-5 pb-5">
                <div>
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-2 h-2.5 w-52" />
                </div>
                <Skeleton className="h-2.5 w-24" />
              </header>
              <div className="grid grid-cols-3 border-t border-[var(--border)] pt-5">
                {[0, 1, 2].map((index) => (
                  <div
                    className="border-l border-[var(--border)] px-5 first:border-l-0 first:pl-0 last:pr-0"
                    key={index}
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-2" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="mt-3 h-5 w-28" />
                    <Skeleton className="mt-2 h-2 w-20" />
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <Card as="section" className="gap-0 p-0">
            <header className="px-6 pb-4 pt-6">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-2.5 w-64" />
            </header>
            <div className="grid grid-cols-1 gap-6 border-t border-[var(--border)] px-6 pb-6 pt-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
              <div className="min-w-0 border-b border-[var(--border)] pb-6 xl:border-b-0 xl:pb-0">
                <OverviewLinePlotSkeleton />
              </div>
              <div className="min-w-0">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="mt-2 h-2 w-32" />
                <OverviewMemberPlotSkeleton />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <Card as="section" className="gap-0 p-0 lg:col-span-8">
              <header className="flex items-start justify-between gap-5 px-6 pb-4 pt-6">
                <div>
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="mt-2 h-2.5 w-64" />
                </div>
                <div className="grid w-48 grid-cols-2 gap-1">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </header>
              <div className="border-t border-[var(--border)] px-5 pb-5 pt-4">
                <OverviewLinePlotSkeleton />
              </div>
            </Card>

            <Card as="section" className="gap-0 lg:col-span-4">
              <header className="flex items-start justify-between gap-4 pb-5">
                <div>
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="mt-2 h-2.5 w-32" />
                </div>
                <Skeleton className="h-2.5 w-10" />
              </header>
              <div className="space-y-4 border-t border-[var(--border)] pt-5">
                {["w-4/5", "w-3/5", "w-full", "w-2/3", "w-1/2"].map(
                  (width, index) => (
                    <div key={index}>
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="size-2 shrink-0" />
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="ml-auto h-2.5 w-8" />
                      </div>
                      <Skeleton className={`mt-2 h-1 ${width}`} />
                      <Skeleton className="mt-2 ml-auto h-2 w-20" />
                    </div>
                  ),
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải ví">
      <div className="mobile-page-skeleton wallet-mobile-skeleton">
        <header className="wallet-mobile-skeleton-header">
          <div>
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2 h-5 w-28" />
          </div>
          <Skeleton className="size-11 rounded-xl" />
        </header>
        <section className="wallet-mobile-skeleton-balance">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-5 h-9 w-52" />
          <div>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        </section>
        <section className="wallet-mobile-skeleton-list">
          <div className="wallet-mobile-skeleton-list-heading">
            <div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-2.5 w-40" />
            </div>
            <Skeleton className="h-3 w-4" />
          </div>
          <Skeleton className="mt-3 h-11 w-full rounded-2xl" />
          <div className="wallet-mobile-skeleton-rows">
            {[0, 1, 2].map((index) => (
              <div className="wallet-mobile-skeleton-row" key={index}>
                <Skeleton className="size-10 rounded-xl" />
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-2.5 w-16" />
                </div>
                <div>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 ml-auto h-2 w-8" />
                </div>
                <Skeleton className="col-start-2 h-2.5 w-20" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="desktop-page-skeleton">
        <div className="mx-auto max-w-[76rem] space-y-5">
          <header className="flex items-start justify-between gap-8 border-b border-[var(--border)] pb-5">
            <div className="space-y-2">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3.5 w-[min(31rem,58vw)]" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0" />
          </header>

          <Card as="section" className="gap-0">
            <div className="grid items-center gap-6 min-[1100px]:grid-cols-[minmax(18rem,1.35fr)_minmax(26rem,1fr)]">
              <div className="flex min-w-0 items-start gap-4">
                <Skeleton className="size-11 shrink-0" />
                <div className="min-w-0 pt-0.5">
                  <Skeleton className="h-3 w-32" />
                  <div className="mt-3 flex items-end gap-2">
                    <Skeleton className="h-9 w-56" />
                    <Skeleton className="mb-0.5 h-3 w-9" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Skeleton className="size-1.5" />
                    <Skeleton className="h-2.5 w-48" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-y border-[var(--border)] min-[1100px]:border-y-0">
                {[0, 1, 2].map((index) => (
                  <div
                    className="px-5 py-4 first:pl-0 last:pr-0 not-first:border-l not-first:border-[var(--border)] min-[1100px]:py-2"
                    key={index}
                  >
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-2 h-5 w-8" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card as="section" className="gap-0">
            <header className="flex items-center justify-between gap-6 pb-5">
              <div className="flex min-w-0 items-start gap-3">
                <Skeleton className="size-10 shrink-0" />
                <div className="pt-0.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-2.5 w-64" />
                </div>
              </div>
              <div className="grid w-[23rem] shrink-0 grid-cols-3 gap-1">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </header>

            <div className="grid grid-cols-[1.25rem_2.5rem_minmax(10rem,1fr)_minmax(8rem,0.7fr)_6.5rem] items-center gap-3 border-t border-[var(--border)] py-2.5 min-[1320px]:grid-cols-[1.25rem_2.5rem_minmax(12rem,1.25fr)_minmax(9rem,0.75fr)_minmax(8rem,0.65fr)_minmax(7rem,0.55fr)_6.5rem]">
              <span />
              <span />
              <Skeleton className="h-2.5 w-8" />
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="hidden h-2.5 w-14 min-[1320px]:block" />
              <Skeleton className="hidden h-2.5 w-12 min-[1320px]:block" />
              <Skeleton className="ml-auto h-2.5 w-14" />
            </div>

            {[0, 1, 2, 3].map((index) => (
              <div
                className="grid min-h-[4.75rem] grid-cols-[1.25rem_2.5rem_minmax(10rem,1fr)_minmax(8rem,0.7fr)_6.5rem] items-center gap-3 border-t border-[var(--border)] py-3.5 min-[1320px]:grid-cols-[1.25rem_2.5rem_minmax(12rem,1.25fr)_minmax(9rem,0.75fr)_minmax(8rem,0.65fr)_minmax(7rem,0.55fr)_6.5rem]"
                key={index}
              >
                <Skeleton className="size-4" />
                <Skeleton className="size-10" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton
                      className={index % 2 === 0 ? "h-3.5 w-24" : "h-3.5 w-32"}
                    />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <Skeleton className="mt-2 h-2.5 w-40" />
                </div>
                <div className="min-w-0">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-2 h-2.5 w-16" />
                </div>
                <div className="hidden min-[1320px]:block">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-2.5 w-24" />
                </div>
                <Skeleton className="hidden h-2.5 w-20 min-[1320px]:block" />
                <div className="flex justify-end gap-1">
                  <Skeleton className="size-8" />
                  <Skeleton className="size-8" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecurringTransactionsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải giao dịch định kỳ">
      <div className="mobile-page-skeleton recurring-mobile-skeleton">
        <header className="recurring-mobile-skeleton-header">
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-2.5 w-56 max-w-[70vw]" />
          </div>
          <Skeleton className="size-11 rounded-xl" />
        </header>

        <section className="recurring-mobile-skeleton-control">
          <Skeleton className="h-2.5 w-24" />
          <div className="recurring-mobile-skeleton-control-main">
            <div>
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="mt-2 h-10 w-12" />
              <Skeleton className="mt-2 h-2.5 w-40" />
            </div>
            <Skeleton className="size-[5.15rem] rounded-full" />
          </div>
          <div className="recurring-mobile-skeleton-stats">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <Skeleton className="h-4 w-5" />
                <Skeleton className="mt-2 h-2 w-14" />
              </div>
            ))}
          </div>
        </section>

        <div className="recurring-mobile-skeleton-tabs">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton className="h-8 w-full rounded-xl" key={index} />
          ))}
        </div>

        <section className="recurring-mobile-skeleton-list">
          {[0, 1, 2].map((index) => (
            <div className="recurring-mobile-skeleton-card" key={index}>
              <Skeleton className="size-[3.15rem] rounded-xl" />
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="mt-2 h-3 w-28" />
                <Skeleton className="mt-2 h-2.5 w-20" />
              </div>
              <footer>
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="ml-auto h-2.5 w-24" />
              </footer>
            </div>
          ))}
        </section>
      </div>

      <div className="desktop-page-skeleton">
        <div className="mx-auto max-w-[76rem] space-y-5">
          <header className="flex items-start justify-between gap-8 border-b border-[var(--border)] pb-5">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-3.5 w-[min(34rem,62vw)]" />
            </div>
            <Skeleton className="h-9 w-28 shrink-0" />
          </header>

          <Card as="section" className="gap-0">
            <div className="grid grid-cols-[minmax(16rem,1.15fr)_minmax(0,1.85fr)] items-stretch">
              <div className="flex min-w-0 items-center gap-4 pr-6">
                <Skeleton className="size-11 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-1.5" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <Skeleton className="h-8 w-9" />
                    <Skeleton className="mb-0.5 h-3.5 w-28" />
                  </div>
                  <Skeleton className="mt-2 h-2.5 w-48" />
                </div>
              </div>

              <div className="grid grid-cols-4 border-l border-[var(--border)]">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    className="flex min-w-0 flex-col items-center justify-center px-4 py-1 text-center"
                    key={index}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Skeleton className="size-3.5" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="mt-2 h-5 w-6" />
                    <Skeleton className="mt-1.5 h-2 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card as="section" className="gap-0">
            <header className="flex items-center justify-between gap-6 pb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-3.5" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
                <Skeleton className="mt-2 h-4 w-48" />
                <Skeleton className="mt-2 h-2.5 w-36" />
              </div>

              <div className="grid w-[34rem] shrink-0 grid-cols-4 gap-1">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </header>

            <div className="border-t border-[var(--border)]">
              {[0, 1, 2].map((index) => (
                <article
                  className="grid min-h-24 grid-cols-[3.5rem_minmax(12rem,1fr)_minmax(22rem,1.55fr)_13rem] items-center gap-4 border-b border-[var(--border)] py-4 last:border-b-0"
                  key={index}
                >
                  <div className="grid place-items-center gap-1">
                    <Skeleton className="h-2 w-8" />
                    <Skeleton className="h-5 w-6" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-12" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton
                      className={
                        index % 2 === 0
                          ? "mt-2.5 h-3.5 w-28"
                          : "mt-2.5 h-3.5 w-40"
                      }
                    />
                    <Skeleton className="mt-2 h-2.5 w-36" />
                  </div>

                  <div className="grid min-w-0 grid-cols-[0.85fr_0.85fr_1.3fr]">
                    {[0, 1, 2].map((metricIndex) => (
                      <div
                        className="min-w-0 border-l border-[var(--border)] px-4 first:border-l-0 first:pl-0"
                        key={metricIndex}
                      >
                        <Skeleton className="h-2 w-14" />
                        <Skeleton
                          className={
                            metricIndex === 2
                              ? "mt-2 h-2.5 w-full max-w-32"
                              : "mt-2 h-2.5 w-20"
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="min-w-0 text-right">
                    <Skeleton className="ml-auto h-3.5 w-28" />
                    <Skeleton className="mt-2 ml-auto h-2.5 w-20" />
                    <div className="mt-2 flex justify-end gap-1">
                      <Skeleton className="size-8" />
                      <Skeleton className="size-8" />
                      <Skeleton className="size-8" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSettingsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải cài đặt workspace">
      <div className="mobile-page-skeleton workspace-mobile-skeleton">
        <section className="workspace-mobile-skeleton-overview">
          <div className="workspace-mobile-skeleton-overview-head">
            <div>
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="mt-2 h-6 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-16 w-24 rounded-xl" />
          </div>
          <div className="workspace-mobile-skeleton-stats">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="mt-2 h-5 w-8" />
              </div>
            ))}
          </div>
        </section>
        <Skeleton className="h-11 w-full rounded-2xl" />
        <section className="workspace-mobile-skeleton-content">
          <div className="workspace-mobile-skeleton-section-heading">
            <Skeleton className="size-9 rounded-xl" />
            <div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-2.5 w-44" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="ml-auto h-10 w-28 rounded-xl" />
        </section>
      </div>

      <div className="desktop-page-skeleton workspace-settings-page">
        <div className="workspace-settings-container mx-auto max-w-[76rem]">
          <header className="mb-6 flex items-start justify-between gap-8">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-3.5 w-[min(38rem,65vw)]" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="size-7" />
            </div>
          </header>

          <div className="grid grid-cols-3 gap-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="mt-5 space-y-5">
            <Card as="section" className="gap-0">
              <div className="flex items-start gap-3">
                <Skeleton className="size-9 shrink-0" />
                <div className="pt-0.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-80" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Skeleton className="h-2.5 w-12" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>

              <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
                <Skeleton className="h-8 w-28" />
              </div>
            </Card>

            <Card as="section" className="gap-0">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div>
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="mt-2 h-3 w-96 max-w-[55vw]" />
                  </div>
                </div>
                <Skeleton className="h-8 w-36" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalSettingsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải cài đặt cá nhân">
      <div className="mobile-page-skeleton personal-settings-mobile-skeleton">
        <section className="personal-settings-skeleton-card">
          <div className="personal-settings-skeleton-heading">
            <Skeleton className="size-9 rounded-xl" />
            <div>
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-2 h-4 w-44" />
            </div>
          </div>
          <div className="personal-settings-skeleton-tabs">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="personal-settings-skeleton-theme">
            <Skeleton className="size-11 rounded-xl" />
            <div>
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
            <Skeleton className="ml-auto size-5 rounded-lg" />
          </div>
        </section>
        <section className="personal-settings-skeleton-card">
          <div className="personal-settings-skeleton-heading">
            <Skeleton className="size-9 rounded-xl" />
            <div>
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
          </div>
          <div className="personal-settings-skeleton-tabs">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-10 w-full rounded-xl" />
          <div className="personal-settings-skeleton-list">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <Skeleton className="size-9 rounded-lg" />
                <div>
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="mt-2 h-2 w-16" />
                </div>
                <Skeleton className="ml-auto h-5 w-10 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="desktop-page-skeleton workspace-settings-page">
        <div className="workspace-settings-container mx-auto max-w-[76rem]">
          <header className="mb-6 space-y-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-[min(34rem,70vw)]" />
          </header>

          <div className="space-y-5">
            <Card as="section" className="gap-0">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0" />
                  <div className="pt-0.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-3 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
              <Skeleton className="mt-6 h-3 w-20" />
              <div className="mt-3 grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <div className="flex gap-1">
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="size-2.5 rounded-full" />
                    </div>
                    <Skeleton
                      className={`h-3 ${index % 2 === 0 ? "w-20" : "w-16"}`}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card as="section" className="gap-0">
              <div className="flex items-start justify-between gap-8">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 shrink-0" />
                  <div className="pt-0.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-72" />
                  </div>
                </div>
                <Skeleton className="h-8 w-36" />
              </div>

              <div className="mt-5 flex items-center justify-between gap-6 py-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-3 w-56" />
              </div>

              <div className="mt-2 space-y-1">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 px-1 py-3"
                  >
                    <Skeleton className="size-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Skeleton
                        className={`h-3 ${index % 2 === 0 ? "w-32" : "w-24"}`}
                      />
                      <Skeleton className="mt-2 h-2.5 w-16" />
                    </div>
                    <Skeleton className="size-7 shrink-0" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function JoinPageSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Đang tải trang tham gia workspace"
    >
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl lg:col-span-5" />
      </div>
    </div>
  );
}

function WorkspaceFormPageSkeleton() {
  return (
    <div
      className="workspace-create-page workspace-create-skeleton"
      aria-busy="true"
      aria-label="Đang tải biểu mẫu workspace"
    >
      <div className="workspace-create-layout">
        <div className="workspace-create-intro">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <div className="mt-10 space-y-3">
            <Skeleton className="h-16 w-full max-w-md rounded-lg" />
            <Skeleton className="h-16 w-4/5 max-w-sm rounded-lg" />
            <Skeleton className="h-4 w-full max-w-sm rounded-lg" />
          </div>
          <Skeleton className="mt-10 h-64 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[38rem] w-full rounded-2xl" />
      </div>
    </div>
  );
}

function MemberAccountsPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6"
      aria-busy="true"
      aria-label="Đang tải biểu mẫu tài khoản thành viên"
    >
      <PageHeaderSkeleton />
      <Skeleton className="h-[32rem] rounded-xl" />
    </div>
  );
}

function AuthPageSkeleton() {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center p-6"
      aria-busy="true"
      aria-label="Đang tải"
    >
      <div className="w-full max-w-md space-y-5">
        <Skeleton className="mx-auto size-12 rounded-xl" />
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    </main>
  );
}

export {
  AuthPageSkeleton,
  DashboardPageSkeleton,
  JoinPageSkeleton,
  MemberAccountsPageSkeleton,
  OverviewPageSkeleton,
  PersonalSettingsPageSkeleton,
  RecurringTransactionsPageSkeleton,
  WalletsPageSkeleton,
  WorkspaceFormPageSkeleton,
  WorkspaceSettingsPageSkeleton,
};
