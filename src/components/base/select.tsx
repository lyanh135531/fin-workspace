"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
import { Label } from "./label";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  selectedContent?: React.ReactNode;
  disabled?: boolean;
};

export type SelectProps = {
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  options: SelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  size?: "sm" | "default";
  spotlight?: boolean;
};

const SelectRoot = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 min-w-0 break-words leading-snug text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex select-base min-h-10 md:min-h-9 w-full items-center justify-between gap-2 rounded-xl md:rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-base md:text-sm text-[var(--foreground)] transition-colors outline-none select-none hover:bg-[var(--surface-hover)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 data-placeholder:text-[var(--text-muted)] data-[size=sm]:min-h-8.5 md:data-[size=sm]:min-h-8 data-[size=sm]:rounded-lg data-[size=sm]:text-xs *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-[var(--text-muted)]" />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) min-w-[max(var(--anchor-width),11rem)] max-w-[calc(100vw-2rem)] w-auto origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--foreground)] duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1 text-xs font-medium text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full min-h-9 cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-sm text-[var(--foreground)] outline-hidden select-none focus:bg-[var(--surface-hover)] data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 min-w-0 items-center gap-2 leading-snug">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-[var(--primary)]" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-[var(--border)]", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-[var(--surface)] py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-[var(--surface)] py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  );
}

function Select({
  id,
  value,
  defaultValue,
  onValueChange,
  name,
  label,
  ariaLabel,
  placeholder,
  options,
  required,
  disabled,
  className,
  contentClassName,
  size,
  spotlight,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const selectId = id ?? (label ? generatedId : undefined);
  const trigger = (
    <SelectTrigger
      id={selectId}
      className={className}
      size={size}
      aria-label={ariaLabel ?? label}
    >
      <SelectValue placeholder={placeholder ?? label}>
        {(selectedValue: string | null) => {
          const selectedOption = options.find(
            (option) => option.value === selectedValue,
          );
          return (
            selectedOption?.selectedContent ??
            selectedOption?.content ??
            selectedOption?.label ??
            placeholder ??
            label
          );
        }}
      </SelectValue>
    </SelectTrigger>
  );
  const select = (
    <SelectRoot
      id={selectId}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange?.(String(nextValue));
      }}
      items={options}
      name={name}
      required={required}
      disabled={disabled}
      open={spotlight ? open : undefined}
      onOpenChange={
        spotlight ? (nextOpen) => setOpen(nextOpen) : undefined
      }
    >
      {spotlight ? (
        <SpotlightTrigger
          open={open}
          onOpenChange={setOpen}
          render={trigger}
          dismissLabel={`Đóng danh sách ${label ?? ariaLabel ?? "lựa chọn"}`}
        >
          {(spotlightTrigger) => spotlightTrigger}
        </SpotlightTrigger>
      ) : trigger}
      <SelectContent align="start" className={contentClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.content ?? option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );

  if (!label) return select;

  return (
    <div className="grid gap-1.5">
      <Label required={required}>{label}</Label>
      {select}
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
