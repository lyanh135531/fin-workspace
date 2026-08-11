import { Skeleton } from "./skeleton"

function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-[min(32rem,80vw)]" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  )
}

function LedgerDesktopRowSkeleton({ index }: { index: number }) {
  const widths = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"]
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
  )
}

function LedgerMobileRowSkeleton({ index }: { index: number }) {
  const widths = ["w-20", "w-24", "w-16", "w-28"]
  return (
    <div className="ledger-skeleton-mobile-row">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7" />
        <Skeleton className={`h-3 ${widths[index % widths.length]}`} />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

function DashboardPageSkeleton() {
  return (
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
  )
}

function OverviewPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải tổng quan tài chính">
      <PageHeaderSkeleton />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-52 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
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

      <div className="desktop-page-skeleton space-y-5">
        <PageHeaderSkeleton />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function RecurringTransactionsPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải giao dịch định kỳ">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-[30rem] w-full rounded-xl" />
    </div>
  )
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

      <div className="desktop-page-skeleton space-y-6">
        <PageHeaderSkeleton />
        <Skeleton className="h-11 w-full max-w-2xl rounded-xl" />
        <div className="grid gap-8 lg:grid-cols-12">
          <Skeleton className="h-[28rem] rounded-xl lg:col-span-7" />
          <Skeleton className="h-56 rounded-xl lg:col-span-5" />
        </div>
      </div>
    </div>
  )
}

function PersonalSettingsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải cài đặt cá nhân">
      <div className="mobile-page-skeleton personal-settings-mobile-skeleton">
        <section>
          <div className="personal-settings-skeleton-heading">
            <Skeleton className="size-9 rounded-xl" />
            <div>
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-2 h-4 w-44" />
            </div>
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
          <Skeleton className="mt-3 h-16 w-full rounded-2xl" />
        </section>
        <section>
          <div className="personal-settings-skeleton-heading">
            <Skeleton className="size-9 rounded-xl" />
            <div>
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
          <div className="personal-settings-skeleton-list">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="ml-auto h-7 w-7 rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="desktop-page-skeleton space-y-6">
        <PageHeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function JoinPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải trang tham gia workspace">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl lg:col-span-5" />
      </div>
    </div>
  )
}

function WorkspaceFormPageSkeleton() {
  return (
    <div className="workspace-create-page workspace-create-skeleton" aria-busy="true" aria-label="Đang tải biểu mẫu workspace">
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
  )
}

function MemberAccountsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true" aria-label="Đang tải biểu mẫu tài khoản thành viên">
      <PageHeaderSkeleton />
      <Skeleton className="h-[32rem] rounded-xl" />
    </div>
  )
}

function AuthPageSkeleton() {
  return (
    <main className="grid min-h-[100dvh] place-items-center p-6" aria-busy="true" aria-label="Đang tải">
      <div className="w-full max-w-md space-y-5">
        <Skeleton className="mx-auto size-12 rounded-xl" />
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
    </main>
  )
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
}
