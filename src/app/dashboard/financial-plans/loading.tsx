import { PageContainer, Skeleton } from "@/components/base";

export default function FinancialPlansLoading() {
  return (
    <PageContainer>
      <div className="mx-auto grid w-full max-w-[76rem] gap-5" aria-label="Đang tải kế hoạch tài chính">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </PageContainer>
  );
}
