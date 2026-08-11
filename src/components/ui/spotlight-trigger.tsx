"use client";

import { cloneElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SpotlightTriggerElement = ReactElement<{ className?: string }>;

type SpotlightTriggerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  render: SpotlightTriggerElement;
  children: (trigger: SpotlightTriggerElement) => ReactNode;
  dismissLabel: string;
};

export function SpotlightTrigger({
  open,
  onOpenChange,
  render,
  children,
  dismissLabel,
}: SpotlightTriggerProps) {
  const spotlightTrigger = cloneElement(render, {
    className: cn(
      render.props.className,
      "spotlight-menu-trigger",
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
          className="spotlight-menu-backdrop"
          onPointerDown={() => onOpenChange(false)}
        />
      )}
      {children(spotlightTrigger)}
    </>
  );
}
