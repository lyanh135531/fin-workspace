"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type SearchProps = Omit<React.ComponentProps<"input">, "type"> & {
  containerClassName?: string
}

function Search({
  className,
  containerClassName,
  placeholder = "Tìm kiếm...",
  "aria-label": ariaLabel,
  ...props
}: SearchProps) {
  return (
    <div
      data-slot="search"
      className={cn("relative w-64 max-w-full shrink-0", containerClassName)}
    >
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <InputPrimitive
        data-slot="search-input"
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-2.5 pl-8 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      />
    </div>
  )
}

export { Search }
