"use client";

import * as React from "react";
import { ArrowLeft, LoaderCircle, X } from "lucide-react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type BottomSheetDragStart = {
  y: number;
  time: number;
};

type SheetPlacement = "edge" | "inset";
type SheetSize = "default" | "wide" | "sm" | "md" | "lg";
type SheetSpacing = "default" | "flush";
type SheetElevation = "raised" | "flat";
type SheetSide = "top" | "right" | "bottom" | "left" | "center";

const MOBILE_SHEET_CLOSE_RATIO = 0.22;
const MOBILE_SHEET_MIN_CLOSE_DISTANCE = 75;
const MOBILE_SHEET_FAST_SWIPE_DISTANCE = 20;
const MOBILE_SHEET_FAST_SWIPE_VELOCITY = 0.35;

type SheetDragContextValue = {
  dragProgress: number;
  setDragProgress: (progress: number) => void;
};

const SheetDragContext = React.createContext<SheetDragContextValue>({
  dragProgress: 0,
  setDragProgress: () => {},
});

function Sheet(props: SheetPrimitive.Root.Props) {
  const [dragProgress, setDragProgress] = React.useState(0);
  return (
    <SheetDragContext.Provider value={{ dragProgress, setDragProgress }}>
      <SheetPrimitive.Root data-slot="sheet" {...props} />
    </SheetDragContext.Provider>
  );
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

function SheetOverlay({ className, style, ...props }: SheetPrimitive.Backdrop.Props) {
  const { dragProgress } = React.useContext(SheetDragContext);

  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      style={{
        ...style,
        opacity: dragProgress > 0 ? Math.max(0, 1 - dragProgress * 0.85) : undefined,
      }}
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
  showClose,
  style,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: SheetSide;
  placement?: SheetPlacement;
  size?: SheetSize;
  spacing?: SheetSpacing;
  elevation?: SheetElevation;
  showClose?: boolean;
}) {
  const { setDragProgress } = React.useContext(SheetDragContext);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const dragStartRef = React.useRef<BottomSheetDragStart | null>(null);
  const recentPositionsRef = React.useRef<{ y: number; time: number }[]>([]);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [isSnapping, setIsSnapping] = React.useState(false);
  const isBottomSheet = side === "bottom";
  const shouldShowClose = showClose ?? (side !== "bottom");

  function resetDrag(): void {
    dragStartRef.current = null;
    recentPositionsRef.current = [];
    setDragging(false);
    setIsSnapping(false);
    setDragOffset(0);
    setDragProgress(0);
  }

  function handleDragStart(event: React.PointerEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    const dragSurface = target.closest(
      '[data-slot="mobile-sheet-drag-handle"], [data-slot="sheet-header"]',
    );
    const interactiveTarget = target.closest(
      "button, a, input, select, textarea, [role='button'], [role='tab'], [role='switch'], label",
    );

    if (
      event.defaultPrevented ||
      !isBottomSheet ||
      event.button !== 0 ||
      !dragSurface ||
      interactiveTarget
    ) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore if pointer capture fails
    }
    const now = performance.now();
    dragStartRef.current = { y: event.clientY, time: now };
    recentPositionsRef.current = [{ y: event.clientY, time: now }];
    setDragging(true);
    setIsSnapping(false);
  }

  function handleDragMove(event: React.PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    const now = performance.now();
    recentPositionsRef.current.push({ y: event.clientY, time: now });
    if (recentPositionsRef.current.length > 8) {
      recentPositionsRef.current = recentPositionsRef.current.slice(-8);
    }

    const deltaY = event.clientY - dragStart.y;
    if (deltaY > 0) {
      event.preventDefault();
      setDragOffset(deltaY);
      const sheetHeight = event.currentTarget.getBoundingClientRect().height || 400;
      setDragProgress(Math.min(1, deltaY / (sheetHeight * 0.6)));
    } else {
      // Elastic rubber-band resistance when pulled upward
      const dampedY = -Math.pow(Math.abs(deltaY), 0.72) * 1.5;
      setDragOffset(dampedY);
      setDragProgress(0);
    }
  }

  function handleDragEnd(event: React.PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart) {
      resetDrag();
      return;
    }

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }

    const distance = Math.max(0, event.clientY - dragStart.y);

    // Instantaneous velocity over the last few tracking frames (flick gesture)
    const recent = recentPositionsRef.current;
    let velocity = 0;
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const timeDiff = Math.max(last.time - first.time, 1);
      velocity = (last.y - first.y) / timeDiff;
    } else {
      const elapsed = Math.max(performance.now() - dragStart.time, 1);
      velocity = distance / elapsed;
    }

    const sheetHeight = event.currentTarget.getBoundingClientRect().height || 400;
    const isFastSwipe =
      distance >= MOBILE_SHEET_FAST_SWIPE_DISTANCE &&
      velocity >= MOBILE_SHEET_FAST_SWIPE_VELOCITY;
    const shouldClose =
      isFastSwipe ||
      distance >= MOBILE_SHEET_MIN_CLOSE_DISTANCE ||
      distance >= sheetHeight * MOBILE_SHEET_CLOSE_RATIO;

    if (shouldClose) {
      resetDrag();
      setDragProgress(1);
      closeButtonRef.current?.click();
    } else {
      // Fluid spring snap-back
      setDragging(false);
      setIsSnapping(true);
      setDragOffset(0);
      setDragProgress(0);
      setTimeout(() => {
        setIsSnapping(false);
        resetDrag();
      }, 300);
    }
  }

  function handleDragCancel(event: React.PointerEvent<HTMLDivElement>): void {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
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
          "fixed z-50 flex min-h-0 flex-col overflow-hidden bg-[var(--surface)] bg-clip-padding text-sm text-[var(--foreground)] shadow-none transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:border-[var(--border)] data-[side=bottom]:rounded-t-2xl sm:data-[side=bottom]:rounded-t-3xl data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]",
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:border-[var(--border)] data-[side=top]:rounded-b-2xl sm:data-[side=top]:rounded-b-3xl data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          "data-[side=center]:left-1/2 data-[side=center]:top-1/2 data-[side=center]:-translate-x-1/2 data-[side=center]:-translate-y-1/2 data-[side=center]:border data-[side=center]:border-[var(--border)] data-[side=center]:rounded-2xl",
          "data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem]",
          "data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem]",
          placement === "inset"
            ? "data-[side=left]:inset-y-2 data-[side=left]:left-2 data-[side=left]:h-[calc(100%-1rem)] data-[side=left]:rounded-2xl data-[side=left]:border data-[side=left]:border-[var(--border)] data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-[calc(100%-1rem)] data-[side=right]:rounded-2xl data-[side=right]:border data-[side=right]:border-[var(--border)] data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:border data-[side=bottom]:rounded-2xl data-[side=top]:inset-x-2 data-[side=top]:top-2 data-[side=top]:border data-[side=top]:rounded-2xl"
            : "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:rounded-none data-[side=left]:border-r data-[side=left]:border-[var(--border)] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:rounded-none data-[side=right]:border-l data-[side=right]:border-[var(--border)]",
          size === "wide" || size === "lg"
            ? "data-[side=center]:w-[calc(100%-2rem)] data-[side=center]:max-w-[42rem] data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-[42rem] data-[side=right]:sm:max-w-[42rem]"
            : size === "sm"
              ? "data-[side=center]:w-[calc(100%-2rem)] data-[side=center]:max-w-sm data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm"
              : "data-[side=center]:w-[calc(100%-2rem)] data-[side=center]:max-w-md data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md",
          spacing === "flush" ? "gap-0" : "gap-4",
          className,
        )}
        style={
          {
            ...style,
            "--mobile-sheet-drag-offset": `${dragOffset}px`,
            ...(dragging
              ? {
                  translate: `0 ${dragOffset}px`,
                  transition: "none",
                }
              : isSnapping
                ? {
                    translate: "0 0",
                    transition: "translate 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
                  }
                : {}),
          } as React.CSSProperties
        }
        {...props}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragCancel}
      >
        {shouldShowClose && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="hidden sm:grid absolute right-4 top-4 z-20 size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] cursor-pointer disabled:pointer-events-none"
            aria-label="Đóng"
          >
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Đóng</span>
          </SheetPrimitive.Close>
        )}
        {isBottomSheet && (
          <div
            data-slot="mobile-sheet-drag-handle"
            className="flex w-full shrink-0 items-center justify-center pt-2.5 pb-1 sm:hidden cursor-grab active:cursor-grabbing touch-none select-none"
            aria-hidden="true"
          >
            <span className="h-1 w-9 rounded-full bg-[var(--text-muted)]/30" />
          </div>
        )}
        {children}
        {isBottomSheet && (
          <SheetPrimitive.Close
            ref={closeButtonRef}
            className="sr-only"
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

function renderIcon(icon: SheetHeaderProps["icon"]) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  const IconComp = icon as React.ElementType;
  return <IconComp size={18} className="size-4.5 shrink-0" aria-hidden="true" />;
}

type SheetHeaderProps = React.ComponentProps<"div"> & {
  icon?: React.ReactNode | React.ComponentType<{ size?: number; className?: string }>;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

function SheetHeader({
  className,
  icon: Icon,
  title,
  description,
  children,
  ...props
}: SheetHeaderProps) {
  const isStructured = Boolean(title !== undefined || Icon !== undefined);

  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "shrink-0 px-5 pt-2.5 pb-3.5 sm:px-6 sm:py-5 sm:pr-14 border-b border-[var(--border)] select-none",
        className,
      )}
      {...props}
    >
      {isStructured ? (
        <div className="flex items-center gap-3 sm:items-start sm:gap-3.5">
          {Icon && (
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] sm:size-10"
              aria-hidden="true"
            >
              {renderIcon(Icon)}
            </span>
          )}
          <div className="min-w-0 flex-1 flex flex-col items-start text-left sm:pt-0.5">
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

type SheetFooterProps = React.ComponentProps<"div"> & {
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  onSubmit?: (e?: React.MouseEvent<HTMLButtonElement> | React.FormEvent) => void;
  submitLabel?: string;
  submitVariant?: "default" | "destructive";
  isSubmitting?: boolean;
  submittingLabel?: string;
  submitDisabled?: boolean;
  submitType?: "button" | "submit";
};

function SheetFooter({
  className,
  onCancel,
  cancelLabel = "Hủy",
  cancelDisabled = false,
  onSubmit,
  submitLabel,
  submitVariant = "default",
  isSubmitting = false,
  submittingLabel = "Đang lưu...",
  submitDisabled = false,
  submitType = "submit",
  children,
  ...props
}: SheetFooterProps) {
  const isStructured = Boolean(submitLabel || onCancel);

  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3.5",
        className,
      )}
      {...props}
    >
      {isStructured ? (
        <>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={cancelDisabled || isSubmitting}
              onClick={onCancel}
              className="hidden sm:inline-flex"
            >
              {cancelLabel}
            </Button>
          )}
          {submitLabel && (
            <Button
              type={submitType}
              variant={submitVariant}
              disabled={submitDisabled || isSubmitting}
              onClick={onSubmit}
              className="w-full sm:w-auto gap-2"
            >
              {isSubmitting && (
                <LoaderCircle
                  className="animate-spin shrink-0"
                  size={14}
                  aria-hidden="true"
                />
              )}
              <span>{isSubmitting ? submittingLabel : submitLabel}</span>
            </Button>
          )}
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base sm:text-xl font-semibold tracking-tight text-[var(--foreground)] text-left",
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
      className={cn(
        "text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 leading-snug text-left",
        className,
      )}
      {...props}
    />
  );
}

type SheetBackButtonProps = {
  onBack: () => void;
  label?: string;
} & Omit<React.ComponentProps<"button">, "onClick" | "children">;

function SheetBackButton({
  onBack,
  label = "Quay lại",
  className,
  ...props
}: SheetBackButtonProps) {
  return (
    <button
      type="button"
      data-slot="sheet-back-button"
      onClick={onBack}
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)] cursor-pointer",
        className,
      )}
      {...props}
    >
      <ArrowLeft size={16} aria-hidden="true" />
    </button>
  );
}

export {
  Sheet,
  SheetBackButton,
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
