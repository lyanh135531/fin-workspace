import * as React from "react";

import { Label } from "@/components/base/label";
import { cn } from "@/lib/utils";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  label?: React.ReactNode;
  wrapperClassName?: string;
};

function Textarea({
  className,
  id,
  label,
  wrapperClassName,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id ?? (label ? generatedId : undefined);
  const textarea = (
    <textarea
      data-slot="textarea"
      id={textareaId}
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-base leading-relaxed text-[var(--foreground)] transition-colors outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-secondary)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:min-h-[5rem] md:p-2.5 md:text-sm md:rounded-lg",
        className,
      )}
      {...props}
    />
  );

  if (!label) return textarea;

  return (
    <div className={cn("grid gap-1.5", wrapperClassName)}>
      <Label htmlFor={textareaId} required={props.required}>{label}</Label>
      {textarea}
    </div>
  );
}

export { Textarea };
