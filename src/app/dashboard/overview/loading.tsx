import { OverviewPageSkeleton, PageContainer } from "@/components/base";

export default function Loading() {
  return (
    <PageContainer>
      <div className="md:mx-auto md:max-w-7xl">
        <OverviewPageSkeleton />
      </div>
    </PageContainer>
  );
}
