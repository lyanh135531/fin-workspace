import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
  className?: string;
  border?: boolean;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  children,
  className,
  border = true,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "mb-4 flex flex-col justify-between gap-3 pb-4 md:mb-6 md:flex-row md:items-center md:gap-4 md:pb-5",
        border && "border-b border-[var(--border)]",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl space-y-1">
        {eyebrow && (
          <span className="inline-flex items-center rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--primary)]">
            {eyebrow}
          </span>
        )}
        <h1 className="break-words text-lg font-semibold leading-snug tracking-tight text-[var(--foreground)] md:text-xl lg:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-xs leading-relaxed text-[var(--text-secondary)] md:text-sm">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:self-center">
          {children}
        </div>
      )}
    </div>
  );
}
