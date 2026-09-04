import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { Label } from "./label";
import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input"> & {
  label?: React.ReactNode;
  wrapperClassName?: string;
  controlClassName?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
};

function Input({
  className,
  type,
  id,
  label,
  wrapperClassName,
  controlClassName,
  startAdornment,
  endAdornment,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id ?? (label ? generatedId : undefined);
  const inputElement = (
    <InputPrimitive
      data-slot="input"
      id={inputId}
      type={type}
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--text-muted)] focus-visible:border-[var(--primary)] focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--surface-secondary)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:h-8 md:py-1 md:text-sm md:rounded-lg dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
  const input =
    startAdornment || endAdornment || controlClassName ? (
      <div className={cn("relative", controlClassName)}>
        {startAdornment}
        {inputElement}
        {endAdornment}
      </div>
    ) : (
      inputElement
    );

  if (!label) return input;

  return (
    <div className={cn("grid gap-1", wrapperClassName)}>
      <Label htmlFor={inputId} required={props.required}>{label}</Label>
      {input}
    </div>
  );
}

export { Input };
