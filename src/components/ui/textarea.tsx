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
        "flex field-sizing-content min-h-16 w-full rounded-2xl border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",

        className,
      )}
      {...props}
    />
  );

  if (!label) return textarea;

  return (
    <div className={cn("grid gap-1", wrapperClassName)}>
      <Label required={props.required}>{label}</Label>
      {textarea}
    </div>
  );
}

export { Textarea };
