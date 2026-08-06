import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: "standard" | "wide" | "full";
}

const containerSizeClasses: Record<
  NonNullable<PageContainerProps["size"]>,
  string
> = {
  standard: "max-w-7xl",
  wide: "max-w-[96rem]",
  full: "max-w-none",
};

export function PageContainer({
  className,
  size = "wide",
  ...props
}: PageContainerProps) {
  return (
    <div
      data-page-container=""
      className={cn(
        "mx-auto w-full min-w-0",
        containerSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
