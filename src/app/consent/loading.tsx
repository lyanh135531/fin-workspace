import { Card, Skeleton } from "@/components/base";

export default function ConsentLoading() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col justify-between bg-[var(--background)] px-4 py-4 sm:px-6 sm:py-8 lg:py-10"
      tabIndex={-1}
      aria-busy="true"
      aria-label="Đang tải trang xác nhận chính sách"
    >
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <Skeleton className="h-8 w-28 rounded-xl" />
        <Skeleton className="size-9 rounded-xl" />
      </header>

      <div className="my-auto flex w-full justify-center py-4 sm:py-6">
        <Card className="w-full max-w-lg space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </Card>
      </div>

      <footer className="mx-auto flex w-full max-w-lg justify-center">
        <Skeleton className="h-3.5 w-64" />
      </footer>
    </main>
  );
}
