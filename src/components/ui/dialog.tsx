"use client";

import { AlertDialog as AlertDialogPrimitive, Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button } from "./button";
import { CloseIcon } from "./icons";

// Modal dialogs on Radix Dialog: focus is trapped, Esc closes, focus returns
// to the opener. Every dialog needs a DialogTitle (Radix warns without one);
// wrap it in VisuallyHidden only when the design truly has no visible title.

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const overlayClassName =
  "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

export function DialogContent({
  className,
  children,
  hideClose = false,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cx(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : <CloseButton />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function CloseButton({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close"
        className={cx("absolute top-3 right-3", className)}
      >
        <CloseIcon />
      </Button>
    </DialogPrimitive.Close>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cx("pr-8 text-lg", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cx("text-muted-foreground", className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

// Confirm a destructive or irreversible action. Unlike Dialog it can't be
// dismissed by clicking outside, and focus starts on Cancel.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClassName} />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out">
          <AlertDialogPrimitive.Title className="text-lg">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted-foreground">
            {description}
          </AlertDialogPrimitive.Description>
          <DialogFooter>
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </DialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
