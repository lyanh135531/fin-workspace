"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

type TabsVariant = "default" | "segmented" | "navigation";
type TabsTone = "expense" | "income";

const tabsListVariantClasses: Record<TabsVariant, string> = {
  default: "h-8 w-fit gap-1 rounded-lg bg-muted p-[3px]",
  segmented:
    "grid h-auto w-full grid-cols-2 gap-0.5 rounded-full border border-border bg-[var(--surface-secondary)] p-0.5",
  navigation:
    "grid h-auto w-full gap-0 rounded-xl bg-[var(--surface-secondary)] p-1",
};

const tabsTriggerVariantClasses: Record<TabsVariant, string> = {
  default:
    "h-6 flex-none rounded-md px-2 py-1 data-active:bg-background data-active:text-foreground data-active:shadow-sm",
  segmented:
    "min-h-7 w-full rounded-full px-2.5 py-1 text-xs data-active:text-foreground",
  navigation:
    "h-8 w-full rounded-lg px-3 py-1.5 text-xs data-active:bg-[var(--surface)] data-active:text-primary",
};

const tabsTriggerToneClasses: Record<TabsTone, string> = {
  expense:
    "text-[var(--expense)] hover:text-[var(--expense)] data-active:bg-[color-mix(in_srgb,var(--expense)_9%,var(--surface))] data-active:text-[var(--expense)]",
  income:
    "text-[var(--income)] hover:text-[var(--income)] data-active:bg-[color-mix(in_srgb,var(--income)_9%,var(--surface))] data-active:text-[var(--income)]",
};

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-6 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  );
}

type TabsListProps = TabsPrimitive.List.Props & {
  variant?: TabsVariant;
};

function TabsList({ className, variant = "default", ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex max-w-full items-center justify-start overflow-x-auto text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        tabsListVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

type TabsTriggerProps = TabsPrimitive.Tab.Props & {
  variant?: TabsVariant;
  tone?: TabsTone;
};

function TabsTrigger({
  className,
  tone,
  variant = "default",
  ...props
}: TabsTriggerProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        tabsTriggerVariantClasses[variant],
        tone && tabsTriggerToneClasses[tone],
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-count"
      className={cn(
        "inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger };
