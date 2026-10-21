"use client";

import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { useMapState } from "@/features/map/map-state";
import type { GroupSize } from "@/lib/ranking";
import { selectedGroupSize } from "./places";

const OPTIONS: { value: GroupSize; label: string }[] = [
  { value: "just_me", label: "Just me" },
  { value: "2_3", label: "2–3" },
  { value: "4_plus", label: "4+" },
];

function isGroupSize(value: string): value is GroupSize {
  return value === "just_me" || value === "2_3" || value === "4_plus";
}

// "How many people?" Just me is selected until the visitor picks another size.
export function GroupSize() {
  const { groupSize, setGroupSize } = useMapState();
  return (
    <div className="rounded-lg border border-input px-3 py-2">
      <ChipGroup
        type="single"
        label="How many people?"
        value={selectedGroupSize(groupSize)}
        onValueChange={(value) => {
          if (isGroupSize(value)) setGroupSize(value);
        }}
        className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 [&>span]:shrink-0"
      >
        {OPTIONS.map((option) => (
          <Chip key={option.value} value={option.value}>
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
