import type { LightLevel, NoiseLevel, SpaceFeature } from "@/lib/data/check-ins";
import type { Database } from "@/types/supabase";

type SpaceSource = Database["public"]["Enums"]["space_source"];

const NOISE: readonly NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];
const LIGHT: readonly LightLevel[] = ["dim", "moderate", "bright"];
const SOURCES: readonly SpaceSource[] = ["um_library", "mguide", "manual"];
const FEATURES: readonly SpaceFeature[] = [
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

export type SpaceBuilding = {
  slug: string;
  name: string;
  shortName: string | null;
  lat: number | null;
  lng: number | null;
};

export type SpaceLocation = {
  floor: number;
  roomNumber: string | null;
};

export type SpaceGallery = {
  src: string;
  alt: string;
};

export type SpaceDetail = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  floor: number | null;
  floorLabel: string | null;
  noiseLevel: NoiseLevel | null;
  lightLevel: LightLevel | null;
  features: SpaceFeature[];
  capacity: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  source: SpaceSource;
  editedFields: string[];
  lat: number | null;
  lng: number | null;
  building: SpaceBuilding | null;
  locations: SpaceLocation[];
  photoCount: number;
  gallery: SpaceGallery | null;
};

export type SpacePhotos = {
  count: number;
  gallery: SpaceGallery | null;
};

type BuildingRow = {
  slug?: string | null;
  name?: string | null;
  short_name?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type SpaceDetailRow = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  summary?: string | null;
  description?: string | null;
  floor?: number | null;
  floor_label?: string | null;
  noise_level?: string | null;
  light_level?: string | null;
  features?: readonly string[] | null;
  capacity?: number | null;
  image_url?: string | null;
  image_alt?: string | null;
  source?: string | null;
  edited_fields?: readonly string[] | null;
  lat?: number | null;
  lng?: number | null;
  building?: BuildingRow | BuildingRow[] | null;
  locations?: { floor?: number | null; room_number?: string | null }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asEnum<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function asNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function locationFloors(locations: readonly { floor: number }[]): number[] {
  return [...new Set(locations.map((location) => location.floor))].sort((a, b) => a - b);
}

/** Floors a printer can match: a placed polygon, or the library's floor number. */
export function floorsForPrinters(space: { floor: number | null; locations: readonly { floor: number }[] }): number[] {
  return [...new Set([...locationFloors(space.locations), ...(space.floor == null ? [] : [space.floor])])].sort((a, b) => a - b);
}

export function toSpaceDetail(row: SpaceDetailRow, photos: SpacePhotos): SpaceDetail | null {
  if (!row.id || !row.slug || !row.name?.trim()) return null;
  const source = asEnum(row.source, SOURCES);
  if (!source) return null;
  const buildingRow = one(row.building);
  const building =
    buildingRow?.slug && buildingRow.name
      ? {
          slug: buildingRow.slug,
          name: buildingRow.name,
          shortName: buildingRow.short_name?.trim() || null,
          lat: asNumber(buildingRow.lat),
          lng: asNumber(buildingRow.lng),
        }
      : null;
  const locations: SpaceLocation[] = [];
  for (const location of row.locations ?? []) {
    const floor = asNumber(location.floor);
    if (floor == null) continue;
    locations.push({ floor, roomNumber: location.room_number?.trim() || null });
  }
  locations.sort((a, b) => a.floor - b.floor || (a.roomNumber ?? "").localeCompare(b.roomNumber ?? ""));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name.trim(),
    summary: row.summary?.trim() || null,
    description: row.description?.trim() || null,
    floor: asNumber(row.floor),
    floorLabel: row.floor_label?.trim() || null,
    noiseLevel: asEnum(row.noise_level, NOISE),
    lightLevel: asEnum(row.light_level, LIGHT),
    features: (row.features ?? []).filter((feature): feature is SpaceFeature => asEnum(feature, FEATURES) != null),
    capacity: asNumber(row.capacity),
    imageUrl: row.image_url?.trim() || null,
    imageAlt: row.image_alt?.trim() || null,
    source,
    editedFields: [...(row.edited_fields ?? [])],
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    building,
    locations,
    photoCount: Number.isInteger(photos.count) && photos.count > 0 ? photos.count : 0,
    gallery: photos.gallery,
  };
}
