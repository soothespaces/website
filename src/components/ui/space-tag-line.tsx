import { cx } from "@/lib/cx";

// One muted line, "Enclosed · Dim · Computers · Printer", ellipsis when the
// row is narrower than the text.
export function SpaceTagLine({ tags, className }: { tags: readonly string[]; className?: string }) {
  if (tags.length === 0) return null;
  const text = tags.join(" · ");
  return (
    <span className={cx("block min-w-0 truncate text-sm text-muted-foreground", className)} title={text}>
      {text}
    </span>
  );
}
