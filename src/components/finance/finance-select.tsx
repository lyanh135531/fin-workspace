"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type FinanceSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type FinanceSelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  label: string;
  placeholder?: string;
  options: FinanceSelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
};

export function FinanceSelect({
  value,
  defaultValue,
  onValueChange,
  name,
  label,
  placeholder,
  options,
  required,
  disabled,
  className,
  contentClassName,
}: FinanceSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label;
  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        const normalizedValue = String(nextValue);
        setInternalValue(normalizedValue);
        onValueChange?.(normalizedValue);
      }}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger className={cn("finance-select-trigger", className)} aria-label={label}>
        <SelectValue placeholder={placeholder ?? label}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className={cn("finance-select-content", contentClassName)}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
