import type { SpaceTag } from "@/components/ui/space-tags";
import type { SpaceSummary } from "./types";

export const NOISE_LABELS: Record<NonNullable<SpaceSummary["noise_level"]>, string> = {
  quiet: "Quiet",
  low_noise: "Low noise",
  conversational: "Conversational",
  loud: "Loud",
};

export const LIGHT_LABELS = {
  dim: "Dim",
  moderate: "Moderate",
  bright: "Bright",
} as const;

export const ENCLOSURE_LABELS = {
  open: "Open",
  enclosed: "Enclosed",
} as const;

export const FEATURE_LABELS: Record<SpaceSummary["features"][number], string> = {
  natural_light: "Natural light",
  wheelchair_accessible: "Wheelchair accessible",
  all_gender_restroom_on_floor: "All-gender restroom",
  whiteboards: "Whiteboards",
  bookable: "Bookable",
  external_monitors: "Monitors",
  outlets: "Outlets",
  computers: "Computers",
  printing: "Printing",
  scanners: "Scanners",
  group_rooms: "Group rooms",
};

// The noise level first (it's what the space is known for), then up to
// `features` of its features. Pass Infinity for all of them.
export function spaceTags(space: SpaceSummary, features = 3): SpaceTag[] {
  const tags: SpaceTag[] = [];
  if (space.noise_level) {
    tags.push({ label: NOISE_LABELS[space.noise_level], icon: "sound", emphasis: true });
  }
  for (const feature of space.features.slice(0, features)) {
    tags.push({ label: FEATURE_LABELS[feature], icon: feature === "natural_light" ? "light" : undefined });
  }
  return tags;
}

type Named = { name: string; short_name?: string | null };

// What students call the building: "Shapiro", "Duderstadt".
export function buildingShortName(building: Named | null | undefined): string | null {
  if (!building) return null;
  return building.short_name?.trim() || building.name;
}

// Where the space is inside its building: "Floor 2 · Computing". Spaces
// without a short name fall back to their full name.
export function spaceShortName(space: Named): string {
  return space.short_name?.trim() || space.name;
}

// The floor, when the short name doesn't already say it.
export function spaceFloorLine(space: Named & { floor_label?: string | null }): string | null {
  const label = space.floor_label?.trim();
  if (!label || space.short_name?.trim()) return null;
  return label.toLowerCase() === space.name.trim().toLowerCase() ? null : label;
}

// The short name under a floor heading, without the floor it repeats:
// "Computing" under "Floor 2". A space that is the whole floor reads "Whole floor".
export function spaceNameOnFloor(space: Named, floorTitle: string | null | undefined): string {
  const name = spaceShortName(space);
  if (!space.short_name?.trim() || !floorTitle) return name;
  if (name === floorTitle) return "Whole floor";
  const prefix = `${floorTitle} · `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

// PlaceName as plain text, for labels and alt text: "Duderstadt, Floor 2 · Computing".
export function spaceTitle(space: Named & { building?: Named | null }): string {
  return [buildingShortName(space.building), spaceShortName(space)].filter(Boolean).join(", ");
}

// The line under a space's name. With a short name the floor is already in
// it, so only the building is left; otherwise "Shapiro · Floor 2".
export function spaceLocation(space: SpaceSummary, { building = true } = {}) {
  const floor = space.short_name?.trim() ? null : space.floor_label;
  return [building ? buildingShortName(space.building) : null, floor].filter(Boolean).join(" · ");
}
