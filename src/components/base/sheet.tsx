"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

type BottomSheetDragStart = {
  y: number;
  time: number;
};

type SheetPlacement = "edge" | "inset";
type SheetSize = "default" | "wide";
type SheetSpacing = "default" | "flush";
type SheetElevation = "raised" | "flat";

const MOBILE_SHEET_QUERY = "(max-width: 760px)";
const MOBILE_SHEET_CLOSE_RATIO = 2 / 3;
const MOBILE_SHEET_FAST_SWIPE_DISTANCE = 24;
const MOBILE_SHEET_FAST_SWIPE_VELOCITY = 0.65;

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  placement = "edge",
  size = "default",
  spacing = "default",
  elevation = "raised",
  style,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  placement?: SheetPlacement;
  size?: SheetSize;
  spacing?: SheetSpacing;
  elevation?: SheetElevation;
}) {
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const dragStartRef = React.useRef<BottomSheetDragStart | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const isBottomSheet = side === "bottom";

  function resetDrag(): void {
    dragStartRef.current = null;
    setDragging(false);
    setDragOffset(0);
  }

  function handleDragStart(event: React.PointerEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    const dragSurface = target.closest(
      '[data-slot="mobile-sheet-drag-handle"], [data-slot="sheet-header"]',
    );
    const interactiveTarget = target.closest(
      "button, a, input, select, textarea, [role='button']",
    );

    if (
      event.defaultPrevented ||
      !isBottomSheet ||
      event.button !== 0 ||
      !dragSurface ||
      interactiveTarget ||
      !window.matchMedia(MOBILE_SHEET_QUERY).matches
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, time: performance.now() };
    setDragging(true);
  }

  function handleDragMove(event: React.PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    event.preventDefault();
    setDragOffset(Math.max(0, event.clientY - dragStart.y));
  }

  function handleDragEnd(event: React.PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      resetDrag();
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = Math.max(0, event.clientY - dragStart.y);
    const elapsed = Math.max(performance.now() - dragStart.time, 1);
    const velocity = distance / elapsed;
    const sheetHeight = event.currentTarget.getBoundingClientRect().height;
    const isFastSwipe =
      distance >= MOBILE_SHEET_FAST_SWIPE_DISTANCE &&
      velocity >= MOBILE_SHEET_FAST_SWIPE_VELOCITY;
    const shouldClose =
      isFastSwipe || distance >= sheetHeight * MOBILE_SHEET_CLOSE_RATIO;

    resetDrag();
    if (shouldClose) closeButtonRef.current?.click();
  }

  function handleDragCancel(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetDrag();
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        data-placement={placement}
        data-size={size}
        data-spacing={spacing}
        data-elevation={elevation}
        data-mobile-sheet-dragging={dragging || undefined}
        className={cn(
          "fixed z-50 flex min-h-0 flex-col overflow-hidden rounded-3xl bg-popover bg-clip-padding text-sm text-popover-foreground transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          placement === "inset"
            ? "data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=left]:inset-y-2 data-[side=left]:left-2 data-[side=left]:h-auto data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=top]:inset-x-2 data-[side=top]:top-2"
            : "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full",
          size === "wide"
            ? "data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-[42rem] data-[side=right]:sm:max-w-[42rem]"
            : "data-[side=left]:w-3/4 data-[side=right]:w-3/4 data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          spacing === "flush" ? "gap-0" : "gap-4",
          elevation === "flat" ? "shadow-none" : "shadow-lg",
          className,
        )}
        style={
          {
            ...style,
            "--mobile-sheet-drag-offset": `${dragOffset}px`,
          } as React.CSSProperties
        }
        {...props}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragCancel}
      >
        {isBottomSheet && (
          <div data-slot="mobile-sheet-drag-handle" aria-hidden="true">
            <span />
          </div>
        )}
        {children}
        {isBottomSheet && (
          <SheetPrimitive.Close
            ref={closeButtonRef}
            hidden
            tabIndex={-1}
            aria-hidden="true"
          >
            Đóng
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("shrink-0 p-3 pt-5", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
