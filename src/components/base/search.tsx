"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

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
      <Input
        data-slot="search-input"
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "w-full pr-3 pl-8",
          className,
        )}
        {...props}
      />
    </div>
  )
}

export { Search }
