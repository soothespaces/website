"use client";

import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

// The only button. Radix has no button primitive; Slot is used so these
// styles can sit on a link. Do not add shadcn/ui or a second button.

const VARIANTS = {
  // Press goes a step past hover, so a tap on a small control shows (DA-18).
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
  outline: "border border-input bg-background hover:bg-accent active:bg-pressed",
  ghost: "hover:bg-accent active:bg-pressed",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
} as const;

const SIZES = {
  md: "min-h-11 gap-2 px-4",
  sm: "min-h-9 gap-1.5 px-3 text-sm",
  icon: "size-11",
  "icon-sm": "size-9",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClassName({
  variant = "primary",
  size = "md",
  shape = "rect",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: "rect" | "circle";
  className?: string;
} = {}) {
  return cx(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md font-medium disabled:pointer-events-none disabled:opacity-40",
    shape === "circle" && "rounded-full",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: "rect" | "circle";
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  shape = "rect",
  asChild = false,
  className,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonClassName({ variant, size, shape, className });
  if (asChild) {
    return <Slot.Root className={classes} {...props} />;
  }
  return <button type={type ?? "button"} className={classes} {...props} />;
}
