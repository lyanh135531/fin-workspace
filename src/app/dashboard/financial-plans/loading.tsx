import { FinancialPlansPageSkeleton, PageContainer } from "@/components/base";

export default function FinancialPlansLoading() {
  return (
    <PageContainer>
      <div className="md:mx-auto md:max-w-7xl">
        <FinancialPlansPageSkeleton />
      </div>
    </PageContainer>
  );
}

