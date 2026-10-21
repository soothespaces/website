"use client";

import { Button } from "@/components/ui/button";
import { ChevronRightIcon, GlobeIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const cardClass =
  "h-auto min-h-0 w-full justify-start gap-3 rounded-xl px-3 py-3 text-left font-normal whitespace-normal disabled:opacity-100";

// "Show on the floor plan". With no space_locations row the subtitle says so
// and the control stays disabled: there is nowhere on the plan to land.
export function FloorPlanCard({ subtitle, onShow }: { subtitle: string; onShow: (() => void) | null }) {
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <GlobeIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Show on the floor plan</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon className="text-muted-foreground" />
    </>
  );
  if (!onShow) {
    return (
      <Button variant="outline" disabled className={cardClass}>
        {body}
      </Button>
    );
  }
  return (
    <Button variant="outline" onClick={onShow} className={cx(cardClass, "hover:bg-accent")}>
      {body}
    </Button>
  );
}
