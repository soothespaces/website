"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

// A short hint on hover and keyboard focus. Never the only place information
// lives: touch screens can't hover, so the label or aria-label must already
// say it. TooltipProvider sits once in the root layout.

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  /** One focusable element, e.g. a Button. */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-sm text-background shadow-md data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
