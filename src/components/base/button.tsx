import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive:
          "bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/15 focus-visible:ring-destructive/20 dark:bg-destructive/25 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        destructiveIcon:
          "relative min-h-8 border-0 bg-transparent p-1 hover:-translate-y-px text-destructive transition-[color,transform] duration-150 hover:text-destructive active:scale-95 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        info: "bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)] hover:bg-[color-mix(in_srgb,var(--info)_18%,var(--surface))]",
        warning:
          "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)] hover:bg-[color-mix(in_srgb,var(--warning)_18%,var(--surface))]",
        success:
          "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] focus-visible:ring-[color-mix(in_srgb,var(--success)_35%,transparent)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        icon: "relative min-h-8 border-0 bg-transparent p-1 text-[var(--text-secondary)] shadow-none transition-[color,transform] duration-150 hover:bg-transparent hover:text-[var(--primary)] hover:-translate-y-px active:scale-95",
        infoIcon:
          "relative min-h-8 border-0 bg-transparent p-1 text-[var(--info)] shadow-none transition-[color,transform] duration-150 hover:bg-transparent hover:text-[var(--info)] hover:-translate-y-px active:scale-95 focus-visible:ring-[color-mix(in_srgb,var(--info)_35%,transparent)]",
        link: "text-primary underline-offset-4 hover:underline",
        unstyled: "",
      },
      size: {
        default: "h-8 px-2.5 rounded-3xl",
        sm: "h-7 rounded-md px-2.5 text-xs",
        lg: "h-10 rounded-md px-4",
        icon: "h-8",
        auto: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function getButtonText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getButtonText(child.props.children);
      }

      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function Button({
  className,
  variant = "default",
  size = "default",
  children,
  title,
  "aria-label": ariaLabel,
  ...props
}: ButtonProps) {
  const resolvedTitle =
    title ||
    (typeof ariaLabel === "string" ? ariaLabel : "") ||
    getButtonText(children) ||
    undefined;

  return (
    <ButtonPrimitive
      data-slot="button"
      aria-label={ariaLabel}
      title={resolvedTitle}
      className={
        variant === "unstyled"
          ? className
          : cn(buttonVariants({ variant, size, className }))
      }
      {...props}
    >
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
