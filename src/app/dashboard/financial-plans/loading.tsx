import { PageContainer, Skeleton } from "@/components/base";

export default function FinancialPlansLoading() {
  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[76rem]" aria-label="Đang tải kế hoạch tài chính">
        <div className="grid gap-4 md:hidden">
          <div className="grid gap-2 py-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-12 w-40" />
          <div className="grid gap-4 rounded-2xl p-4 ring-1 ring-[var(--border)]">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="hidden gap-5 md:grid">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </PageContainer>
  );
}
