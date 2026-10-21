"use client";

import { Chip, ChipGroup } from "@/components/ui/chip-group";
import { LightIcon, SoundQuietIcon } from "@/components/ui/icons";
import { selectableFilters, type SpaceFilter } from "./space-filters";

// Restroom locations are not on the map yet (BK1). The chip stays focusable
// so the reason is available to the keyboard, and it cannot be selected.
export function SpaceFilterChips({
  value,
  onValueChange,
}: {
  value: readonly SpaceFilter[];
  onValueChange: (value: SpaceFilter[]) => void;
}) {
  return (
    <ChipGroup
      type="multiple"
      label="Filter spaces"
      labelHidden
      value={selectableFilters(value)}
      onValueChange={(next) => onValueChange(selectableFilters(next as SpaceFilter[]))}
    >
      <Chip value="quiet" icon={<SoundQuietIcon size="sm" />}>
        Quiet
      </Chip>
      <Chip value="dim" icon={<LightIcon size="sm" />}>
        Dim lighting
      </Chip>
      <Chip value="computers">Computers</Chip>
      <Chip value="printer">Printer nearby</Chip>
      <Chip value="restroom" disabled disabledReason="Restroom locations coming soon">
        Restroom nearby
      </Chip>
    </ChipGroup>
  );
}
