import { Card, Skeleton } from "@/components/base";

export default function ConsentLoading() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 py-8">
      <Card className="mx-auto w-full max-w-2xl gap-5">
        <Skeleton className="size-12" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </main>
  );
}
