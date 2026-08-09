import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Label } from "./label"

export type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "inputMode" | "type" | "value" | "onChange" | "label"> & {
  value: string
  onValueChange: (value: string) => void
  label?: React.ReactNode
  wrapperClassName?: string
}

function formatVndAmount(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function MoneyInput({ className, id, label, placeholder = "0", wrapperClassName, value, onValueChange, ...props }: MoneyInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? (label ? generatedId : undefined)
  const input = (
    <div className="relative" data-slot="money-input-control">
      <Input
        id={inputId}
        inputMode="numeric"
        placeholder={placeholder}
        value={formatVndAmount(value)}
        onChange={(event) => onValueChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        className={cn("pr-14 text-right font-medium tabular-nums", className)}
        {...props}
      />
      <span
        data-slot="money-input-currency"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground"
        aria-hidden
      >
        VND
      </span>
    </div>
  )

  if (!label) return input

  return (
    <div data-slot="money-input" className={cn("grid gap-1", wrapperClassName)}>
      <Label required={props.required}>{label}</Label>
      {input}
    </div>
  )
}

export { MoneyInput }
