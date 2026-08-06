import { LoaderCircle } from "lucide-react"
import { type ComponentPropsWithRef } from "react"

import { cn } from "@/lib/utils"

type LoadingProps = ComponentPropsWithRef<"span"> & {
  label: string
}

function Loading({ className, label, ...props }: LoadingProps) {
  return (
    <span
      {...props}
      data-slot="loading"
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center justify-center gap-2", className)}
    >
      <LoaderCircle
        data-slot="loading-icon"
        aria-hidden="true"
        className="size-4 animate-spin motion-reduce:animate-none"
      />
      <span>{label}</span>
    </span>
  )
}

export { Loading }
export type { LoadingProps }
