"use client";

import {
  cloneElement,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type SpotlightTriggerElement = ReactElement<{ className?: string }>;

type SpotlightTriggerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  render: SpotlightTriggerElement;
  children: (trigger: SpotlightTriggerElement) => ReactNode;
  dismissLabel: string;
  mobileOnly?: boolean;
};

export function SpotlightTrigger({
  open,
  onOpenChange,
  render,
  children,
  dismissLabel,
  mobileOnly = false,
}: SpotlightTriggerProps) {
  function blockBackdropPointer(event: PointerEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
  }

  function dismissFromBackdrop(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.stopPropagation();
    onOpenChange(false);
  }

  const spotlightTrigger = cloneElement(render, {
    className: cn(
      render.props.className,
      "spotlight-menu-trigger",
      mobileOnly && "spotlight-menu-trigger-mobile-only",
      open && "spotlight-menu-trigger-active",
    ),
  });

  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={dismissLabel}
          className={cn(
            "spotlight-menu-backdrop",
            mobileOnly && "spotlight-menu-backdrop-mobile-only",
          )}
          onPointerDown={blockBackdropPointer}
          onClick={dismissFromBackdrop}
          onContextMenu={dismissFromBackdrop}
        />
      )}
      {children(spotlightTrigger)}
    </>
  );
}
