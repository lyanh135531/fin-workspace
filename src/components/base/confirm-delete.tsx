"use client"

import { LoaderCircle, Trash2 } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/base/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type ConfirmDeleteProps = {
  ariaLabel: string
  title: string
  description: ReactNode
  onConfirm: () => void | Promise<void>
  cancelLabel?: string
  confirmLabel?: string
  disabled?: boolean
  className?: string
}

function ConfirmDelete({
  ariaLabel,
  title,
  description,
  onConfirm,
  cancelLabel = "Hủy",
  confirmLabel = "Xóa",
  disabled,
  className,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, setIsPending] = useState<boolean>(false)

  function handleOpenChange(nextOpen: boolean): void {
    if (!isPending) {
      setOpen(nextOpen)
    }
  }

  async function handleConfirm(): Promise<void> {
    setIsPending(true)

    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={ariaLabel}
            disabled={disabled || isPending}
            className={cn(
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              className
            )}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        }
      />

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

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            aria-busy={isPending}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ConfirmDelete }
export type { ConfirmDeleteProps }
