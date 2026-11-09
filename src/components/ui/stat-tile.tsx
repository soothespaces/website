import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

type StatTileBase = {
  label: string;
  value: string;
  detail?: string;
  /** Colors the value with the accent, as on "Open 24 hours". */
  tone?: "positive";
  className?: string;
};

type StatTileProps = StatTileBase &
  (
    | { href: string; onClick?: undefined }
    | { onClick: () => void; href?: undefined }
    | { href?: undefined; onClick?: undefined }
  );

const tileClass =
  "flex h-auto min-h-0 w-full shrink flex-col items-start justify-start gap-0.5 whitespace-normal rounded-xl border border-border bg-card p-3 text-left font-normal";

export function StatTile({ label, value, detail, tone, className, href, onClick }: StatTileProps) {
  const body = (
    <>
      <span className="block w-full text-xs text-muted-foreground">{label}</span>
      {/* A size down in a phone's three-across row keeps "Open until 10 PM"
          on one line (DA-15). */}
      <span
        className={cx(
          "block w-full text-base font-semibold break-words @max-[24rem]:text-sm",
          tone === "positive" && "text-primary",
        )}
      >
        {value}
      </span>
      {detail ? <span className="block w-full text-xs break-words text-muted-foreground">{detail}</span> : null}
    </>
  );
  if (href) {
    return (
      <Button asChild variant="ghost" className={cx(tileClass, "hover:bg-accent", className)}>
        <Link href={href}>{body}</Link>
      </Button>
    );
  }
  if (onClick) {
    return (
      <Button variant="ghost" onClick={onClick} className={cx(tileClass, "hover:bg-accent", className)}>
        {body}
      </Button>
    );
  }
  // Not a control (Floors, SOS-144): a flat tile with no border, so it does
  // not look like the buttons beside it (DA-19).
  return <div className={cx(tileClass, "border-transparent bg-muted", className)}>{body}</div>;
}

// One row of tiles sized to their words, sharing the spare width (QA-038).
// Equal thirds wrapped "Open 24 hours" and "Closes Fri 6 PM" onto two lines
// (DA-15), so each tile starts at its own content width and grows from there.
// When three don't fit, the last one wraps to its own row (SOS-103) instead of
// a value breaking mid-phrase.
export function StatTileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("@container", className)}>
      <div className="flex flex-wrap gap-2 *:w-auto *:min-w-[min(100%,6rem)] *:flex-[1_1_auto]">{children}</div>
    </div>
  );
}
