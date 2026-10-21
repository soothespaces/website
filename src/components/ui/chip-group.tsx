"use client";

import { ToggleGroup } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Tooltip } from "@/components/ui/tooltip";

// Single-select is a radiogroup (announced as checked). Multi-select is a
// toolbar of toggle buttons (announced as pressed). Arrow keys move focus;
// Space and Enter toggle. Radix owns both.

type ChipGroupBase = {
  label: string;
  /** Hide the label visually. It stays the group's accessible name. */
  labelHidden?: boolean;
  children: ReactNode;
  className?: string;
  /** Extra classes for the chip row. `flex-nowrap overflow-x-auto` scrolls instead of wrapping. */
  groupClassName?: string;
};

type ChipGroupProps = ChipGroupBase &
  (
    | { type: "single"; value: string; onValueChange: (value: string) => void }
    | { type: "multiple"; value: string[]; onValueChange: (value: string[]) => void }
  );

export function ChipGroup(props: ChipGroupProps) {
  const labelId = useId();
  const groupClass = cx("flex flex-wrap gap-2", props.groupClassName);
  const label = (
    <span id={labelId} className={props.labelHidden ? "sr-only" : "text-sm font-medium"}>
      {props.label}
    </span>
  );
  return (
    <div className={cx("flex flex-col gap-2", props.className)}>
      {label}
      {props.type === "single" ? (
        <ToggleGroup.Root
          type="single"
          value={props.value}
          onValueChange={(value) => {
            if (value) props.onValueChange(value);
          }}
          aria-labelledby={labelId}
          className={groupClass}
        >
          {props.children}
        </ToggleGroup.Root>
      ) : (
        <ToggleGroup.Root
          type="multiple"
          value={props.value}
          onValueChange={props.onValueChange}
          aria-labelledby={labelId}
          className={groupClass}
        >
          {props.children}
        </ToggleGroup.Root>
      )}
    </div>
  );
}

const chipClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-medium hover:bg-accent data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-background";

export function Chip({
  value,
  children,
  icon,
  disabled = false,
  disabledReason,
}: {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Shown in a tooltip and in the accessible name. */
  disabledReason?: string;
}) {
  const name =
    disabled && disabledReason
      ? `${typeof children === "string" ? children : "Option"}. ${disabledReason}`
      : undefined;
  const item = (
    <ToggleGroup.Item
      value={value}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      aria-label={name}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
      className={chipClass}
    >
      {icon}
      {name ? <span aria-hidden="true">{children}</span> : children}
    </ToggleGroup.Item>
  );
  if (disabled && disabledReason) {
    return <Tooltip content={disabledReason}>{item}</Tooltip>;
  }
  return item;
}
