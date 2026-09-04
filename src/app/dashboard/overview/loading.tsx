import { OverviewPageSkeleton, PageContainer } from "@/components/base";

export default function Loading() {
  return (
    <PageContainer>
      <div className="min-[901px]:mx-auto min-[901px]:max-w-[76rem]">
        <OverviewPageSkeleton />
      </div>
    </PageContainer>
  );
}
