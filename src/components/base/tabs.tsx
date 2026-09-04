"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

type TabsVariant = "default" | "segmented" | "navigation" | "underline";
type TabsTone = "expense" | "income";

const TabsListContext = React.createContext<{ variant: TabsVariant }>({
  variant: "default",
});

const tabsListVariantClasses: Record<TabsVariant, string> = {
  default:
    "h-10 md:h-8 w-fit gap-0.5 rounded-xl md:rounded-lg bg-[var(--surface-secondary)] p-0.5",
  segmented:
    "grid h-10 md:h-8 w-full grid-cols-2 gap-0.5 rounded-xl md:rounded-lg bg-[var(--surface-secondary)] p-0.5",
  navigation:
    "grid h-10 md:h-8 w-full gap-0.5 rounded-xl md:rounded-lg bg-[var(--surface-secondary)] p-0.5",
  underline:
    "h-10 w-full gap-6 border-b border-[var(--border)] bg-transparent p-0",
};

const tabsTriggerVariantClasses: Record<TabsVariant, string> = {
  default:
    "h-full flex-none rounded-lg md:rounded-md px-3 md:px-2.5 py-1 text-xs md:text-sm font-medium data-active:bg-[var(--surface)] data-active:text-[var(--foreground)]",
  segmented:
    "h-full w-full rounded-lg md:rounded-md px-3 md:px-2.5 py-1 text-xs md:text-sm font-medium data-active:bg-[var(--surface)] data-active:text-[var(--foreground)]",
  navigation:
    "h-full w-full rounded-lg md:rounded-md px-3 md:px-2.5 py-1 text-xs md:text-sm font-medium data-active:bg-[var(--surface)] data-active:text-primary",
  underline:
    "h-10 rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium text-[var(--text-secondary)] data-active:border-[var(--primary)] data-active:text-[var(--foreground)] data-active:font-semibold hover:text-[var(--foreground)]",
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

function TabsList({ className, variant = "default", children, ...props }: TabsListProps) {
  return (
    <TabsListContext.Provider value={{ variant }}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        className={cn(
          "inline-flex max-w-full items-center justify-start overflow-x-auto overflow-y-hidden text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          tabsListVariantClasses[variant],
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  );
}

type TabsTriggerProps = TabsPrimitive.Tab.Props & {
  variant?: TabsVariant;
  tone?: TabsTone;
};

function TabsTrigger({
  className,
  tone,
  variant: explicitVariant,
  ...props
}: TabsTriggerProps) {
  const context = React.useContext(TabsListContext);
  const variant = explicitVariant ?? context.variant;

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs md:text-sm font-medium text-muted-foreground transition-colors touch-manipulation select-none",
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
