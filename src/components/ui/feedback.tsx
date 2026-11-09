import { Separator as SeparatorPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

// Loading, empty and divider pieces. Not Radix behavior (except Separator);
// they are here so every page draws them the same way.

// A placeholder block while data loads. Put role="status" and a visually
// hidden "Loading…" on the container, not on each block.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** A smaller box for an empty list inside a panel. Same treatment (DA-21). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed border-input text-center",
        compact ? "px-4 py-4 text-sm" : "px-6 py-10",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Separator({ className, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cx(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

// SOS-169: loading is a skeleton the size of what loads, not a sentence.
// The label is read out; the blocks are hidden from screen readers.
export function SkeletonRows({
  label,
  rows = 3,
  rowClassName = "h-10",
  className,
}: {
  label: string;
  rows?: number;
  rowClassName?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cx("flex flex-col gap-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cx("w-full", rowClassName)} />
      ))}
    </div>
  );
}
