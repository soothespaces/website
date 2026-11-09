"use client";

import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { useMapState } from "@/features/map/map-state";
import type { SpaceFilters } from "@/features/map/space-filters";

const KEYS = ["quiet", "openLate", "dimLighting", "bookable"] as const;

const OPTIONS: { value: (typeof KEYS)[number]; label: string }[] = [
  { value: "quiet", label: "Quiet" },
  { value: "openLate", label: "Open late" },
  { value: "dimLighting", label: "Dim lighting" },
  { value: "bookable", label: "Bookable" },
];

function filtersFrom(values: string[]): SpaceFilters {
  return {
    quiet: values.includes("quiet"),
    openLate: values.includes("openLate"),
    dimLighting: values.includes("dimLighting"),
    bookable: values.includes("bookable"),
  };
}

// Quiet, open late, dim and bookable. On a phone the row scrolls sideways.
export function QuickChips() {
  const { filters, setFilters } = useMapState();
  const selected = KEYS.filter((key) => filters[key]);
  return (
    <ChipGroup
      type="multiple"
      label="Filters"
      labelHidden
      value={selected}
      onValueChange={(values) => setFilters(filtersFrom(values))}
      className="min-w-0 w-full"
      // One row everywhere (SOS-151, QA-081). Phones scroll it; on the 384px
      // dock the chips and gaps tighten so all four fit, and a larger text
      // size scrolls instead of clipping (QA-031). The 4px pad keeps a chip's
      // focus ring inside the scroller (DA-26).
      groupClassName="min-w-0 flex-nowrap overflow-x-auto overscroll-x-contain p-1 -m-1 md:gap-1.5 md:*:px-2.5"
    >
      {OPTIONS.map((option) => (
        <Chip key={option.value} value={option.value}>
          {option.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
