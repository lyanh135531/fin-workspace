import { Card, Skeleton } from "@/components/base";

export default function OnboardingLoading() {
  return (
    <main
      id="main-content"
      className="min-h-dvh bg-[var(--surface)] text-[var(--foreground)]"
      tabIndex={-1}
      aria-busy="true"
      aria-label="Đang tải trang thiết lập lần đầu"
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6 lg:px-8">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="size-9 rounded-xl" />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-6 md:px-6 md:pt-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(32rem,1.2fr)] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-20">
        <section className="space-y-4 lg:pt-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full max-w-md rounded-xl md:h-16" />
          <Skeleton className="h-16 w-full max-w-lg rounded-xl" />
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {[0, 1].map((card) => (
            <Card key={card} className="space-y-5 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="size-11 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
