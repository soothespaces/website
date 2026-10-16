"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// Non-modal floating panel anchored to a trigger (filters, a room's details).
// Esc and outside clicks close it and focus returns to the trigger.

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  sideOffset = 8,
  align = "center",
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={16}
        className={cx(
          "z-50 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
