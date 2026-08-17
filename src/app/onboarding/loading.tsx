import { Card, Skeleton } from "@/components/base";

export default function OnboardingLoading() {
  return (
    <main id="main-content" className="min-h-dvh bg-[var(--surface)]" tabIndex={-1}>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(32rem,1.2fr)] lg:gap-16 lg:px-8 lg:pt-20">
        <section className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-20 w-full max-w-lg" />
        </section>
        <section className="grid gap-4">
          <Card className="p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </section>
      </div>
    </main>
  );
}
