import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  children?: ReactNode; // Actions
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
      className={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6",
        border && "border-b border-slate-100 dark:border-slate-800",
        className
      )}
    >
      <div className="space-y-1.5 max-w-2xl">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </span>
        )}
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0 md:self-center">
          {children}
        </div>
      )}
    </div>
  );
}
