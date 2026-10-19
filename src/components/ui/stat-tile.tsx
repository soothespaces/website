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
      <span className={cx("block w-full text-base font-semibold break-words", tone === "positive" && "text-primary")}>
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
  return <div className={cx(tileClass, className)}>{body}</div>;
}

// Three tiles across at 400px, two in between, one at 320px.
export function StatTileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("@container", className)}>
      <div className="grid grid-cols-1 gap-2 @min-[22rem]:grid-cols-2 @min-[25rem]:grid-cols-3">{children}</div>
    </div>
  );
}
