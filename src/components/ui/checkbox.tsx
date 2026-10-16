"use client";

import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { CheckIcon } from "./icons";

// Checkbox for picking several things (amenity filters); Switch for a setting
// that takes effect at once. Both need a <Label htmlFor> next to them.

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cx(
        "flex size-5 shrink-0 items-center justify-center rounded-sm border border-input bg-background disabled:opacity-40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input bg-muted transition-colors disabled:opacity-40 data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
