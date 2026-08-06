import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

type FormPendingSkeletonProps = {
  label: string
  className?: string
}

function FormPendingSkeleton({ label, className }: FormPendingSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2", className)}
    >
      <Skeleton className="h-2 w-16 shrink-0" />
      <Skeleton className="h-2 w-28" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export { FormPendingSkeleton }
export type { FormPendingSkeletonProps }
