import { type ComponentPropsWithRef } from "react"

import { cn } from "@/lib/utils"

type SkeletonProps = ComponentPropsWithRef<"div">

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonProps }
