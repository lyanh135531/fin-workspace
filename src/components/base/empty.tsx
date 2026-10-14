import * as React from "react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyIcon = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

export type EmptyProps = React.ComponentProps<"div"> & {
  icon?: EmptyIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "compact" | "inline";
};

function Empty({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  variant = "default",
  className,
  ...props
}: EmptyProps) {
  return (
    <div
      data-slot="empty"
      data-variant={variant}
      className={cn(
        "flex h-full w-full flex-1 flex-col items-center justify-center text-center",
        variant === "default" && "min-h-44 p-6 md:p-8",
        variant === "compact" && "min-h-32 p-5 md:p-6",
        variant === "inline" && "min-h-20 p-4",
        className,
      )}
      {...props}
    >
      <span
        data-slot="empty-icon"
        className={cn(
          "grid shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
          variant === "default" ? "size-11" : "size-9",
        )}
      >
        <Icon
          aria-hidden
          className={variant === "default" ? "size-5" : "size-4"}
        />
      </span>
      <h3
        data-slot="empty-title"
        className={cn(
          "font-semibold tracking-tight text-[var(--foreground)] text-balance",
          variant === "default" ? "mt-3.5 text-sm md:text-base" : "mt-2.5 text-sm",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          data-slot="empty-description"
          className="mt-1 max-w-sm text-xs md:text-sm leading-relaxed text-[var(--text-secondary)] text-pretty"
        >
          {description}
        </p>
      )}
      {action && (
        <div data-slot="empty-action" className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

export { Empty };
