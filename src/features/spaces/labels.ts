import type { SpaceTag } from "@/components/ui/space-tags";
import type { SpaceSummary } from "./types";

export const NOISE_LABELS: Record<NonNullable<SpaceSummary["noise_level"]>, string> = {
  quiet: "Quiet",
  low_noise: "Low noise",
  conversational: "Conversational",
  loud: "Loud",
};

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

// "Shapiro Library · Floor 2", or whichever of the two is known.
export function spaceLocation(space: SpaceSummary, { building = true } = {}) {
  return [building ? space.building?.name : null, space.floor_label].filter(Boolean).join(" · ");
}
