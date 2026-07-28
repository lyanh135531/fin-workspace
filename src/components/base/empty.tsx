import * as React from "react"
import { InboxIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

export type EmptyProps = React.ComponentProps<"div"> & {
  icon?: EmptyIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "compact" | "inline"
}

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
        "flex w-full flex-col items-center justify-center text-center",
        variant === "default" &&
          "min-h-44 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10",
        variant === "compact" &&
          "min-h-32 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-6",
        variant === "inline" && "min-h-20 px-4 py-5",
        className,
      )}
      {...props}
    >
      <span
        data-slot="empty-icon"
        className={cn(
          "grid shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground shadow-sm",
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
          "font-semibold tracking-tight text-foreground text-balance",
          variant === "default" ? "mt-4 text-base" : "mt-3 text-sm",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          data-slot="empty-description"
          className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty"
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
  )
}

export { Empty }
