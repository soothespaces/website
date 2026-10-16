"use client";

import { Accordion as AccordionPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { ChevronDownIcon } from "./icons";

// Tabs switch between views of the same thing (Map / List). Accordion opens
// one section on demand, for the side panel's tier-2 details (full hours,
// spaces by floor).

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cx("inline-flex gap-1 rounded-md border border-input bg-muted p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cx(
        "min-h-9 rounded-sm px-3 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  title,
  children,
  value,
  className,
}: {
  title: string;
  children: ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <AccordionPrimitive.Item value={value} className={cx("border-b border-border", className)}>
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="group flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left font-medium">
          {title}
          <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="pb-4">{children}</AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
