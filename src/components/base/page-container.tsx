import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> { }

export function PageContainer({ className, ...props }: PageContainerProps) {
  return (
    <div className={cn("w-full", className)} {...props} />
  )
}
