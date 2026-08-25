"use client"

import { LoaderCircle, Trash2 } from "lucide-react"
import { useState, type ReactElement, type ReactNode } from "react"

import { Button } from "@/components/base/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
  trigger?: ReactElement | null
  presentation?: "popover" | "sheet"
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
  trigger,
  presentation = "popover",
}: ConfirmDeleteProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(false)
  const [isPending, setIsPending] = useState<boolean>(false)
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

  if (presentation === "sheet") {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {resolvedTrigger && <SheetTrigger render={resolvedTrigger} />}
        <SheetContent
          side="bottom"
          className="ledger-mobile-review-sheet pending-delete"
          aria-label={ariaLabel}
        >
          <SheetHeader className="ledger-mobile-review-header">
            <div className="ledger-mobile-review-heading">
              <span aria-hidden="true">
                <Trash2 size={18} />
              </span>
              <div>
                <SheetTitle>{title}</SheetTitle>
                <SheetDescription>{description}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {content && <div className="ledger-mobile-review-body">{content}</div>}
          <SheetFooter className="ledger-mobile-review-actions">
            <Button
              type="button"
              variant="outline"
              className="ledger-mobile-review-reject"
              data-delete
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="ledger-mobile-review-approve"
              data-delete
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
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-72 gap-4 p-4"
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
