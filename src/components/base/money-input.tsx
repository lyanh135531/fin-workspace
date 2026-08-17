import * as React from "react"

import { cn } from "@/lib/utils"
import {
  MAX_MONEY_INTEGER_DIGITS,
  MONEY_INPUT_LIMIT_ERROR_MESSAGE,
} from "@/lib/money-limits"
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

function MoneyInput({ className, id, label, placeholder = "0", wrapperClassName, value, onValueChange, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }: MoneyInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? (label ? generatedId : undefined)
  const limitErrorId = `${inputId ?? generatedId}-limit-error`
  const exceedsMaximum = value.replace(/\D/g, "").length > MAX_MONEY_INTEGER_DIGITS
  const describedBy = [ariaDescribedBy, exceedsMaximum ? limitErrorId : undefined]
    .filter(Boolean)
    .join(" ") || undefined
  const input = (
    <div className="relative" data-slot="money-input-control">
      <Input
        id={inputId}
        inputMode="numeric"
        placeholder={placeholder}
        value={formatVndAmount(value)}
        onChange={(event) => onValueChange(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        aria-describedby={describedBy}
        aria-invalid={exceedsMaximum || ariaInvalid}
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
      <Label htmlFor={inputId} required={props.required}>{label}</Label>
      {input}
      {exceedsMaximum && (
        <p id={limitErrorId} className="text-xs text-destructive" role="alert">
          {MONEY_INPUT_LIMIT_ERROR_MESSAGE}
        </p>
      )}
    </div>
  )
}

export { MoneyInput }
