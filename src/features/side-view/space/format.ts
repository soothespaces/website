import { FEATURE_LABELS } from "@/features/spaces/labels";
import type { PanelRoute } from "@/features/side-view/panel-route";
import type { SpaceFeature } from "@/lib/data/check-ins";

/** Meters covered in a minute at a typical walking pace, about 3 mph. */
export const WALK_METERS_PER_MINUTE = 80;

// Amenities on "What's here". Natural light, outlets, and a printer already
// named in "What it's like" are left out so the same fact is not listed twice.
const WHATS_HERE: readonly SpaceFeature[] = [
  "natural_light",
  "wheelchair_accessible",
  "all_gender_restroom_on_floor",
  "whiteboards",
  "bookable",
  "external_monitors",
  "outlets",
  "computers",
  "printing",
  "scanners",
  "group_rooms",
];

const CHIP_LABEL: Partial<Record<SpaceFeature, string>> = {
  all_gender_restroom_on_floor: "All-gender restroom on floor",
};

const COVERED_BY_ROW: Partial<Record<string, SpaceFeature>> = {
  light: "natural_light",
  power: "outlets",
  nearby: "printing",
};

export function photoCountLabel(count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null;
  return count === 1 ? "1 photo" : `${count} photos`;
}

/** Floors from `space_locations`. No rows means the plan does not know this spot yet. */
export function floorPlanSubtitle(floors: readonly number[]): string {
  const unique = [...new Set(floors)].sort((a, b) => a - b);
  if (unique.length === 0) return "Floor not listed yet";
  if (unique.length === 1) return `Floor ${unique[0]}`;
  const last = unique[unique.length - 1];
  const rest = unique.slice(0, -1).join(", ");
  return `Floors ${rest} and ${last}`;
}

export function whatsHereLabels(features: readonly string[], rowIds: readonly string[] | null): string[] {
  const omit = new Set<SpaceFeature>();
  if (rowIds) {
    for (const id of rowIds) {
      const feature = COVERED_BY_ROW[id];
      if (feature) omit.add(feature);
    }
  }
  const present = new Set(features);
  const labels: string[] = [];
  for (const feature of WHATS_HERE) {
    if (!present.has(feature) || omit.has(feature)) continue;
    labels.push(CHIP_LABEL[feature] ?? FEATURE_LABELS[feature]);
  }
  return labels;
}

/** The board's short line. `summary` is that sentence; the long listing is the fallback. */
export function spaceParagraph(summary: string | null | undefined, description: string | null | undefined): string | null {
  const short = summary?.trim();
  if (short) return short;
  const long = description?.trim();
  return long || null;
}

export function buildingDisplayName(building: { name: string; shortName: string | null } | null): string | null {
  if (!building) return null;
  const short = building.shortName?.trim();
  return short || building.name;
}

/**
 * F1.1 says "Opens at 8 AM" for later today. The space meta line reads
 * "Closed now · opens 8 AM". A day with no later opening stays "Closed today".
 */
export function spaceOpenStatus(status: string | null): string | null {
  if (!status) return null;
  const later = /^Opens at (.+)$/.exec(status);
  if (later) return `Closed now · opens ${later[1]}`;
  return status;
}

export function walkTimeLabel(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  const minutes = Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
  return `${minutes} min walk`;
}

export function walkPoint(
  space: { lat: number | null; lng: number | null },
  building: { lat: number | null; lng: number | null } | null,
): { lat: number; lng: number } | null {
  if (space.lat != null && space.lng != null) return { lat: space.lat, lng: space.lng };
  if (building?.lat != null && building.lng != null) return { lat: building.lat, lng: building.lng };
  return null;
}

export function heroPhoto(space: {
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  gallery: { src: string; alt: string } | null;
}): { src: string; alt: string } | null {
  if (space.imageUrl) {
    return { src: space.imageUrl, alt: space.imageAlt?.trim() || `Photo of ${space.name}` };
  }
  if (!space.gallery) return null;
  return { src: space.gallery.src, alt: space.gallery.alt.trim() || `Photo of ${space.name}` };
}

export function spaceBackLabel(parent: PanelRoute | undefined, buildingName: string | null): string {
  if (!parent || parent.kind === "home") return "Back";
  if (parent.kind === "building") {
    const name = parent.name?.trim() || buildingName?.trim();
    return name ? `Back to ${name}` : "Back";
  }
  return "Back";
}
