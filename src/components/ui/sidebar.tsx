"use client";

import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "fin-sidebar-collapsed";
const SIDEBAR_STATE_EVENT = "fin-sidebar-state-change";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextValue = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function getStoredSidebarState(): boolean {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function subscribeToSidebarState(listener: () => void): () => void {
  window.addEventListener(SIDEBAR_STATE_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(SIDEBAR_STATE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function useOptionalSidebar(): SidebarContextValue | null {
  return React.useContext(SidebarContext);
}

function useSidebar(): SidebarContextValue {
  const context = useOptionalSidebar();

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const collapsed = React.useSyncExternalStore(
    subscribeToSidebarState,
    getStoredSidebarState,
    () => !defaultOpen,
  );
  const open = !collapsed;

  const setOpen = React.useCallback((nextOpen: boolean): void => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!nextOpen));
    window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT));
  }, []);

  const toggleSidebar = React.useCallback((): void => {
    setOpen(!open);
  }, [open, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      toggleSidebar,
    }),
    [open, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "15.5rem",
            "--sidebar-width-icon": "4rem",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex h-dvh min-h-0 w-full overflow-hidden max-[900px]:block max-[900px]:h-auto max-[900px]:min-h-dvh max-[900px]:overflow-visible",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  className,
  collapsible = "icon",
  children,
  ...props
}: React.ComponentProps<"aside"> & { collapsible?: "icon" | "none" }) {
  const { state } = useSidebar();

  if (collapsible === "none") {
    return (
      <aside
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col border-r border-[var(--border)] bg-[var(--surface)]",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    );
  }

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      className="group peer hidden text-[var(--foreground)] min-[901px]:block"
    >
      <div
        data-slot="sidebar-gap"
        className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-in-out will-change-[width] group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
      />
      <aside
        data-slot="sidebar-container"
        aria-label="Điều hướng"
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden h-dvh w-(--sidebar-width) border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-300 ease-in-out will-change-[width] min-[901px]:flex group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          className,
        )}
        {...props}
      >
        <div
          data-slot="sidebar-inner"
          className="flex size-full min-w-0 flex-col overflow-hidden bg-[var(--surface)] gap-4 px-2"
        >
          {children}
        </div>
      </aside>
    </div>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex shrink-0 flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex shrink-0 flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("w-full min-w-0 text-sm", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

function SidebarMenuButton({
  render,
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & { isActive?: boolean }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm font-medium text-[var(--text-secondary)] outline-none transition-[width,gap,background-color,color] duration-300 ease-in-out hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-active:bg-[color-mix(in_srgb,var(--primary)_14%,var(--surface))] data-active:text-[var(--primary)] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-2! [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "sidebar-menu-button",
      active: isActive,
    },
  });
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-label="Đóng hoặc mở thanh điều hướng"
      title="Đóng hoặc mở thanh điều hướng"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 -right-4 z-30 hidden w-4 -translate-x-1/2 cursor-w-resize transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-px hover:after:bg-[var(--border-strong)] min-[901px]:flex [[data-state=collapsed]_&]:cursor-e-resize",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn("dashboard-frame min-w-0 flex-1", className)}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useOptionalSidebar,
  useSidebar,
};
