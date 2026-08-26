import { FinancialPlansPageSkeleton, PageContainer } from "@/components/base";

export default function Loading() {
  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[76rem]">
        <FinancialPlansPageSkeleton />
      </div>
    </PageContainer>
  );
}
