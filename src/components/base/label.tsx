"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export type LabelProps = React.ComponentProps<"label"> & {
  required?: boolean
}

function Label({ className, children, required = false, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 text-xs leading-snug font-medium text-[var(--text-secondary)] select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}

export { Label }
