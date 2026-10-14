import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[background-color,color,border-color,transform] duration-150 cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive touch-manipulation active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--text-on-primary)] hover:bg-[var(--primary-hover)]",
        landing:
          "bg-[var(--primary)] text-[var(--text-on-primary)] transition-[background-color,transform] duration-200 hover:bg-[var(--primary-hover)] active:scale-[0.98]",
        destructive:
          "bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface))] focus-visible:ring-[var(--danger)]/30",
        destructiveIcon:
          "relative min-h-8 border-0 bg-transparent p-1 text-[var(--danger)] transition-[color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)] active:scale-95 focus-visible:ring-[var(--danger)]/30",
        outline:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        filter:
          "border border-[var(--border)] bg-[var(--surface)] px-3 !text-sm font-normal text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        secondary:
          "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        info: "bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info)] hover:bg-[color-mix(in_srgb,var(--info)_18%,var(--surface))]",
        selected:
          "bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_18%,var(--surface))] focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]",
        warning:
          "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)] hover:bg-[color-mix(in_srgb,var(--warning)_18%,var(--surface))]",
        success:
          "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] focus-visible:ring-[color-mix(in_srgb,var(--success)_35%,transparent)]",
        fab: "bg-[var(--primary)] text-[var(--text-on-primary)] transition-transform hover:bg-[var(--primary-hover)] active:scale-95",
        ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
        icon: "relative min-h-8 border-0 bg-transparent p-1 text-[var(--text-secondary)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] active:scale-95",
        infoIcon:
          "relative min-h-8 border-0 bg-transparent p-1 text-[var(--info)] transition-[color,background-color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--info)_10%,transparent)] hover:text-[var(--info)] active:scale-95 focus-visible:ring-[color-mix(in_srgb,var(--info)_35%,transparent)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
        unstyled: "",
      },
      size: {
        default:
          "h-10 px-4 text-sm font-medium rounded-xl md:h-9 md:px-3.5 md:text-sm md:rounded-lg [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8.5 px-3 text-xs font-medium rounded-lg md:h-8 md:px-3 md:text-xs md:rounded-lg gap-1.5 [&_svg:not([class*='size-'])]:size-3.5 md:[&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 px-5 text-sm font-semibold rounded-xl md:h-10 md:px-4 md:text-sm md:font-medium md:rounded-lg [&_svg:not([class*='size-'])]:size-[18px] md:[&_svg:not([class*='size-'])]:size-4",
        icon: "size-10 rounded-xl md:size-9 md:rounded-lg p-0 [&_svg:not([class*='size-'])]:size-4",
        fab: "size-12 aspect-square rounded-full p-0 active:scale-95 [&_svg:not([class*='size-'])]:size-5",
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
  render,
  nativeButton,
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
      render={render}
      nativeButton={nativeButton ?? (render ? false : undefined)}
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
