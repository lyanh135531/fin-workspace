import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

export type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "inputMode" | "type" | "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}

function formatVndAmount(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function MoneyInput({ className, value, onValueChange, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <Input
        inputMode="numeric"
        value={formatVndAmount(value)}
        onChange={(event) => onValueChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        className={cn("pr-14 font-medium tabular-nums", className)}
        {...props}
      />
      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground"
        aria-hidden
      >
        VND
      </span>
    </div>
  )
}

export { MoneyInput }
