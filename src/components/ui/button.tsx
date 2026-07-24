import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.35),0_2px_8px_rgba(255,91,61,0.25)] hover:bg-[color-mix(in_srgb,var(--primary)_92%,#000)] hover:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.45),0_6px_18px_rgba(255,91,61,0.35)] hover:-translate-y-0.5",
        outline:
          "border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-border-strong hover:bg-muted hover:text-foreground hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-0.5",
        secondary:
          "border border-border bg-surface text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1.5px_4px_rgba(0,0,0,0.04)] hover:border-border-strong hover:bg-surface-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25),0_2px_8px_rgba(232,67,53,0.25)] hover:bg-[color-mix(in_srgb,var(--destructive)_90%,#000)] hover:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.35),0_6px_18px_rgba(232,67,53,0.35)] hover:-translate-y-0.5",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 min-h-[2.25rem] px-3.5 text-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7.5 gap-1.5 rounded-lg px-3 text-[0.82rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 rounded-xl px-5 text-base",
        icon: "size-9 rounded-xl",
        "icon-xs":
          "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7.5 rounded-lg",
        "icon-lg": "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
