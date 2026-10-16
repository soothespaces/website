"use client";

import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { inputClassName } from "./field";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";

// A styled single-choice dropdown with typeahead and arrow keys. For two to
// four visible options prefer a radio group (ChoiceGroup); a select hides them.

export type SelectOption = { value: string; label: string };

export function Select({
  options,
  placeholder,
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: ComponentProps<typeof SelectPrimitive.Root> & {
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
  /** Matches a Label's htmlFor. */
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        id={id}
        aria-describedby={describedBy}
        className={cx(inputClassName, "inline-flex items-center justify-between gap-2 text-left", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDownIcon />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-pop-in"
        >
          <SelectPrimitive.ScrollUpButton className="flex justify-center py-1">
            <ChevronUpIcon />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-10 cursor-default items-center rounded-sm py-2 pr-3 pl-8 outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2">
                  <CheckIcon />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex justify-center py-1">
            <ChevronDownIcon />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
