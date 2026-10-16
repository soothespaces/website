"use client";

import { ToggleGroup } from "radix-ui";
import { useId } from "react";
import type { FloorPlan } from "../use-floor-index";

// Picks which floor plan the map draws for a building. "Off" hides it.
export function FloorSwitcher({
  floors,
  floor,
  onChange,
}: {
  floors: FloorPlan[];
  floor: number | null;
  onChange: (floor: number | null) => void;
}) {
  const labelId = useId();
  const item =
    "flex h-11 min-w-11 items-center justify-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium">
        Floor plan
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={labelId}
        value={floor == null ? "off" : String(floor)}
        // Radix sends "" when the pressed item is pressed again; keep it on.
        onValueChange={(value) => value && onChange(value === "off" ? null : Number(value))}
        className="flex flex-wrap gap-1.5"
      >
        {floors.map((f) => (
          <ToggleGroup.Item key={f.floor} value={String(f.floor)} aria-label={`Floor ${f.floor}`} className={item}>
            {f.floor}
          </ToggleGroup.Item>
        ))}
        <ToggleGroup.Item value="off" className={item}>
          Off
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  );
}
