"use client"

import { LoaderCircle, Trash2 } from "lucide-react"
import { useState, useSyncExternalStore, type ReactElement, type ReactNode } from "react"

import { Button } from "@/components/base/button"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@/components/base/sheet"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

function subscribeMobileViewport(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getMobileViewportSnapshot(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getMobileViewportServerSnapshot(): boolean {
  return false
}

type ConfirmDeleteProps = {
  ariaLabel: string
  title: string
  description: ReactNode
  content?: ReactNode
  onConfirm: () => void | boolean | Promise<void | boolean>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  cancelLabel?: string
  confirmLabel?: string
  confirmDisabled?: boolean
  disabled?: boolean
  className?: string
  contentClassName?: string
  trigger?: ReactElement | null
  presentation?: "popover" | "sheet"
  anchor?: React.RefObject<Element | null>
}

function ConfirmDelete({
  ariaLabel,
  title,
  description,
  content,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
  cancelLabel = "Hủy",
  confirmLabel = "Xóa",
  confirmDisabled = false,
  disabled,
  className,
  contentClassName,
  trigger,
  presentation,
  anchor,
}: ConfirmDeleteProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(false)
  const [isPending, setIsPending] = useState<boolean>(false)
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot,
  )
  const resolvedPresentation = presentation ?? (isMobileViewport ? "sheet" : "popover")
  const open = controlledOpen ?? internalOpen

  function handleOpenChange(nextOpen: boolean): void {
    if (!isPending) {
      if (controlledOpen === undefined) setInternalOpen(nextOpen)
      onOpenChange?.(nextOpen)
    }
  }

  async function handleConfirm(): Promise<void> {
    if (confirmDisabled) return
    setIsPending(true)

    try {
      const shouldClose = await onConfirm()
      if (shouldClose === false) return
      if (controlledOpen === undefined) setInternalOpen(false)
      onOpenChange?.(false)
    } finally {
      setIsPending(false)
    }
  }

  const resolvedTrigger = trigger === null
    ? null
    : trigger ?? (
      <Button
        variant="icon"
        size="icon"
        className={className}
        aria-label={ariaLabel}
        disabled={disabled || isPending}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    )

  function renderActions(size?: "sm") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={isPending}
          onClick={() => handleOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size={size}
          aria-busy={isPending}
          disabled={isPending || confirmDisabled}
          onClick={handleConfirm}
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
          {confirmLabel}
        </Button>
      </>
    )
  }

  const hasPopoverAnchor = trigger !== null || Boolean(anchor)

  if (resolvedPresentation === "sheet" || isMobileViewport || !hasPopoverAnchor) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {resolvedTrigger && <SheetTrigger render={resolvedTrigger} />}
        <SheetContent
          side={isMobileViewport ? "bottom" : "center"}
          size={isMobileViewport ? "default" : "sm"}
          className={cn(contentClassName)}
          aria-label={ariaLabel}
        >
          <SheetHeader
            icon={Trash2}
            title={title}
            description={description}
          />
          {content && <div className="p-4 overflow-y-auto">{content}</div>}
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 sm:flex-none"
              aria-busy={isPending}
              disabled={isPending || confirmDisabled}
              onClick={handleConfirm}
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {confirmLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {resolvedTrigger && <PopoverTrigger render={resolvedTrigger} />}

      <PopoverContent
        role="alertdialog"
        anchor={anchor}
        side="bottom"
        align="end"
        sideOffset={6}
        className={cn("w-72 gap-4 p-4", contentClassName)}
      >
        <PopoverHeader className="gap-1.5">
          <PopoverTitle className="text-base font-semibold">
            {title}
          </PopoverTitle>
          <PopoverDescription className="leading-relaxed">
            {description}
          </PopoverDescription>
        </PopoverHeader>

        {content}

        <div className="flex justify-end gap-2">
          {renderActions("sm")}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ConfirmDelete }
export type { ConfirmDeleteProps }
