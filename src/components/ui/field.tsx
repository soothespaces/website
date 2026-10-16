"use client";

import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// Text fields. Radix has no text input, so this is a styled native <input>.
// Always pair it with a Label (htmlFor) and put help or error text in a hint
// linked with aria-describedby.

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cx("font-medium", className)} {...props} />;
}

export const inputClassName =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground disabled:opacity-40 aria-invalid:border-destructive";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClassName, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClassName, "min-h-24 py-2", className)} {...props} />;
}

export function FieldHint({
  error = false,
  className,
  ...props
}: ComponentProps<"p"> & { error?: boolean }) {
  return (
    <p
      className={cx("text-sm", error ? "text-destructive" : "text-muted-foreground", className)}
      {...props}
    />
  );
}
