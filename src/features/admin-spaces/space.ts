// Shared by the /admin/spaces pages, their server actions and the browser.
import type { Database } from "@/types/supabase";

type Enums = Database["public"]["Enums"];
export type NoiseLevel = Enums["noise_level"];
export type LightLevel = Enums["light_level"];
export type SpaceFeature = Enums["space_feature"];

export const NOISE_LEVELS: NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];
export const LIGHT_LEVELS: LightLevel[] = ["dim", "moderate", "bright"];
export const LIGHT_LABELS: Record<LightLevel, string> = { dim: "Dim", moderate: "Moderate", bright: "Bright" };

/** Polygon rings in map coordinates, as GeoJSON stores them. */
export type Ring = [number, number][];

/**
 * Part of the building a space covers on one floor: a room on the vector
 * floor plan, or an outline drawn for an open area. `id` is set once saved.
 */
export type SpaceLocation = {
  id?: string;
  floor: number;
  roomNumber: string | null;
  area: Ring | null;
};

/** What the editor reads and writes. */
export type SpaceFields = {
  name: string;
  summary: string | null;
  description: string | null;
  floor: number | null;
  floorLabel: string | null;
  noiseLevel: NoiseLevel | null;
  lightLevel: LightLevel | null;
  features: SpaceFeature[];
  capacity: number | null;
  isListed: boolean;
  lat: number | null;
  lng: number | null;
};

export type AdminSpace = SpaceFields & {
  id: string;
  slug: string;
  buildingSlug: string;
  source: Enums["space_source"];
  sourceUrl: string | null;
  /** Columns changed by hand, which the seed leaves alone. */
  editedFields: string[];
  locations: SpaceLocation[];
};

// The columns scripts/seed/build.mjs writes, with the editor's name for
// each. Only these can be "kept from the seed".
export const SEEDED_FIELDS: Record<string, string> = {
  name: "Name",
  summary: "Summary",
  description: "Description",
  floor: "Floor",
  floor_label: "Floor label",
  noise_level: "Noise",
  features: "Amenities",
  capacity: "Seats",
  is_listed: "Shown on the site",
};

export const SOURCE_LABELS: Record<Enums["space_source"], string> = {
  um_library: "U-M Library",
  mguide: "MGuide",
  manual: "Added here",
};

/** A slug for a space added by hand; the manual- prefix keeps it clear of the sources' slugs. */
export function manualSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `manual-${base || "space"}`;
}

/** The middle of a polygon ring: the mean of its corners (the closing point counted once). */
export function ringCenter(ring: Ring): [number, number] {
  const points = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [lng, lat];
}

export function round(value: number) {
  return Math.round(value * 1e7) / 1e7;
}

export function describeLocation(location: SpaceLocation) {
  return location.roomNumber ? `Room ${location.roomNumber}, floor ${location.floor}` : `An area on floor ${location.floor}`;
}
