"use client";

import { EnterIcon, HomeIcon, LightIcon, LightningBoltIcon, PersonIcon, PinIcon } from "@/components/ui/icons";
import type { AttributeSpace } from "@/lib/data/attributes";
import { useCheckInSummary } from "@/lib/data/check-ins";
import { usePrinters } from "@/lib/data/printers";
import { countPrintersOnFloors, whatItsLikeRows, type LikeRow, type LikeRowId } from "./rows";

const ICONS: Record<LikeRowId, typeof HomeIcon> = {
  setting: HomeIcon,
  light: LightIcon,
  seating: PersonIcon,
  entrance: EnterIcon,
  nearby: PinIcon,
  power: LightningBoltIcon,
};

export function useWhatItsLikeRows(
  space: {
    id: string;
    buildingSlug: string | null;
    floors: number[];
    attributes: AttributeSpace;
  } | null,
): LikeRow[] | null {
  const checkIns = useCheckInSummary("space", space?.id ?? null);
  const printers = usePrinters(space?.buildingSlug ?? null);
  if (!space) return null;
  return whatItsLikeRows({
    attributes: space.attributes,
    summary: checkIns.loaded ? checkIns.summary : null,
    printersOnFloors: printers.loaded ? countPrintersOnFloors(printers.printers, space.floors) : null,
    // BK1 (point amenities) is what can put a restroom in this sentence.
    restroomOnFloor: false,
  });
}

export function WhatItsLike({ rows }: { rows: readonly LikeRow[] | null }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section aria-labelledby="space-what-its-like" className="flex flex-col gap-1">
      <h2 id="space-what-its-like" className="text-base">
        What it&apos;s like
      </h2>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const Icon = ICONS[row.id];
          return (
            <li key={row.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{row.value}</span>
                <span className="block text-xs text-muted-foreground">{row.source}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
