"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { CloseButton, overlayClassName } from "./dialog";

// A dialog that slides in from the bottom (phones, the room drawer) or the
// right (side panels). Same behavior as Dialog: focus trap, Esc, focus
// returns. Use SheetTitle; the map drawer can keep the map visible with
// modal={false} on Sheet.

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const SIDES = {
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down",
  right:
    "inset-y-0 right-0 h-full w-[min(26rem,100%)] border-l data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right",
} as const;

export function SheetContent({
  side = "bottom",
  overlay = true,
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof SIDES;
  overlay?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      {overlay ? <DialogPrimitive.Overlay className={overlayClassName} /> : null}
      <DialogPrimitive.Content
        className={cx(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-popover p-6 text-popover-foreground shadow-lg",
          SIDES[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div aria-hidden="true" className="mx-auto -mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/40" />
        ) : null}
        {children}
        <CloseButton />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { DialogTitle as SheetTitle, DialogDescription as SheetDescription } from "./dialog";
