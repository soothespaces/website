import type { SpaceSummary } from "@/features/spaces/types";
import type { Database } from "@/types/supabase";
import { distanceToBuildingMeters, type GeoPoint } from "../location";
import type {
  BrightnessLevel,
  DaylightLevel,
  NiceToHaveAmenity,
  NoiseLevel,
  RankableSpace,
  RankContext,
  SpaceSetting,
  StudyPreferences,
} from "./index";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

/**
 * A list row (`SpaceSummary`), a `spaces` row, or a space already in ranking shape.
 * Wave 1 screens (A4, C3, H4, J3, K2, K4) can pass any of these to `toRankableSpace`.
 */
export type RankableSpaceInput = SpaceSummary | SpaceRow | RankableSpace;

export type RankableSpaceOptions = {
  isOpenNow?: boolean;
  isOpenLate?: boolean;
  /** When set, used as-is instead of measuring from `userCoords`. */
  distanceMeters?: number | null;
  /** GPS fix or `{ lat, lng }`. Measured to the building, then the space pin. */
  userCoords?: GeoPoint | null;
};

// Library noise is quiet < low_noise < conversational < loud. Ranking has no
// step between quiet and moderate, so low_noise stays with quiet. Ranking's
// own words (silent, quiet, moderate, lively) pass through unchanged.
const NOISE_FROM_STORED: Record<string, NoiseLevel> = {
  silent: "silent",
  quiet: "quiet",
  low_noise: "quiet",
  moderate: "moderate",
  conversational: "moderate",
  social: "lively",
  lively: "lively",
  loud: "lively",
};

const BRIGHTNESS_FROM_STORED: Record<string, BrightnessLevel> = {
  dim: "dim",
  medium: "medium",
  moderate: "medium",
  bright: "bright",
};

const SETTING_FROM_STORED: Record<string, SpaceSetting | "any"> = {
  enclosed: "enclosed",
  open: "open",
  any: "any",
};

const DAYLIGHT_FROM_STORED: Record<string, DaylightLevel | "any"> = {
  windowless: "windowless",
  some_daylight: "some_daylight",
  bright_daylight: "bright_daylight",
  any: "any",
};

// `space_feature` values, plus ranking amenity keys already in that vocabulary.
const AMENITY_FROM_STORED: Record<string, NiceToHaveAmenity> = {
  outlets: "outlets",
  whiteboards: "whiteboard",
  whiteboard: "whiteboard",
  external_monitors: "external_monitors",
  computers: "caen_computers",
  caen_computers: "caen_computers",
  printing: "near_printer",
  near_printer: "near_printer",
  all_gender_restroom_on_floor: "near_restroom",
  near_restroom: "near_restroom",
  near_water: "near_water",
  near_entrance: "near_entrance",
  bookable: "bookable",
};

const WHEN_YOU_STUDY = ["morning", "afternoon", "evening", "late_night"] as const;

type WhenYouStudy = NonNullable<StudyPreferences["whenYouStudy"]>[number];

function isRankableSpace(space: RankableSpaceInput): space is RankableSpace {
  return "buildingId" in space && !("noise_level" in space) && !("building_slug" in space);
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") return [value];
  return [];
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function noiseFromStored(value: unknown): NoiseLevel[] {
  return unique(asStrings(value).flatMap((token) => NOISE_FROM_STORED[token] ?? []));
}

function amenitiesFromStored(value: unknown): NiceToHaveAmenity[] {
  return unique(asStrings(value).flatMap((token) => AMENITY_FROM_STORED[token] ?? []));
}

function hasNaturalLight(value: unknown): boolean {
  return asStrings(value).includes("natural_light");
}

/**
 * `user_settings.settings.needs` (and the same object in settings extras) → ranking preferences.
 * Accepts the stored shape `{ noise, features }` and ranking's own field names.
 * Step-free access has no ranking signal yet, so `wheelchair_accessible` is ignored.
 */
export function studyPreferencesFromNeeds(needs: unknown): StudyPreferences {
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) return {};
  const record = needs as Record<string, unknown>;
  const preferences: StudyPreferences = {};

  const noise = noiseFromStored(record.noise);
  if (noise.length > 0) preferences.noise = noise;

  const setting = typeof record.setting === "string" ? SETTING_FROM_STORED[record.setting] : undefined;
  if (setting) preferences.setting = setting;

  const brightnessSource = record.brightness ?? record.light ?? record.light_level;
  if (brightnessSource === "any") {
    preferences.brightness = "any";
  } else if (typeof brightnessSource === "string" && BRIGHTNESS_FROM_STORED[brightnessSource]) {
    preferences.brightness = BRIGHTNESS_FROM_STORED[brightnessSource];
  }

  const daylight = typeof record.daylight === "string" ? DAYLIGHT_FROM_STORED[record.daylight] : undefined;
  if (daylight) {
    preferences.daylight = daylight;
  } else if (hasNaturalLight(record.features) || hasNaturalLight(record.niceToHave)) {
    preferences.daylight = "some_daylight";
  }

  const niceToHave = amenitiesFromStored(record.niceToHave ?? record.features);
  if (niceToHave.length > 0) preferences.niceToHave = niceToHave;

  const whenYouStudy = unique(
    asStrings(record.whenYouStudy).filter((token): token is WhenYouStudy =>
      (WHEN_YOU_STUDY as readonly string[]).includes(token),
    ),
  );
  if (whenYouStudy.length > 0) preferences.whenYouStudy = whenYouStudy;

  return preferences;
}

/**
 * Ranking context from `parseSettings` / `readStoredSettings` extras.
 * Saved `needs` fill `preferences` unless the caller already passed them.
 */
export function rankContextFromSettings(
  extras: Record<string, unknown> | null | undefined,
  context: RankContext = {},
): RankContext {
  return {
    ...context,
    preferences: context.preferences ?? studyPreferencesFromNeeds(extras?.needs),
  };
}

type RecordSpace = {
  id?: string;
  slug?: string;
  name: string;
  building_slug?: string;
  floor?: number | null;
  floor_label?: string | null;
  noise_level?: string | null;
  light_level?: string | null;
  features?: readonly string[] | null;
  capacity?: number | null;
  lat?: number | null;
  lng?: number | null;
  building?: { slug: string; lat: number | null; lng: number | null } | null;
};

function floorOf(space: RecordSpace): string | number | null {
  if (typeof space.floor === "number") return space.floor;
  if (typeof space.floor_label === "string" && space.floor_label) return space.floor_label;
  return null;
}

function buildingPoint(space: RecordSpace): { lat: number | null; lng: number | null } | null {
  const building = space.building;
  if (building && Number.isFinite(building.lat) && Number.isFinite(building.lng)) {
    return { lat: building.lat, lng: building.lng };
  }
  if (Number.isFinite(space.lat) && Number.isFinite(space.lng)) {
    return { lat: space.lat ?? null, lng: space.lng ?? null };
  }
  return null;
}

function fromRecord(space: RecordSpace, options: RankableSpaceOptions | undefined): RankableSpace {
  const features = space.features ?? [];
  const amenities: Partial<Record<NiceToHaveAmenity, boolean>> = {};
  for (const feature of features) {
    const amenity = AMENITY_FROM_STORED[feature];
    if (amenity) amenities[amenity] = true;
  }

  const noiseValues = noiseFromStored(space.noise_level);
  const brightness =
    typeof space.light_level === "string" ? BRIGHTNESS_FROM_STORED[space.light_level] : undefined;
  const capacity =
    typeof space.capacity === "number" && Number.isFinite(space.capacity) && space.capacity > 0
      ? space.capacity
      : undefined;

  let distanceMeters = options?.distanceMeters;
  if (distanceMeters === undefined && options?.userCoords) {
    const point = buildingPoint(space);
    distanceMeters = point ? distanceToBuildingMeters(options.userCoords, point) : null;
  }

  return {
    id: space.id || space.slug || "",
    name: space.name,
    buildingId: space.building_slug || space.building?.slug || "",
    floor: floorOf(space),
    isOpenNow: options?.isOpenNow,
    isOpenLate: options?.isOpenLate,
    noise: noiseValues[0] ?? null,
    brightness: brightness ?? null,
    daylight: features.includes("natural_light") ? "some_daylight" : null,
    maxGroupSize: capacity ?? null,
    bookable: features.includes("bookable"),
    amenities,
    distanceMeters,
  };
}

/**
 * Turns a space record into the shape `rankSpaces` scores, keeping the original
 * fields (slug, summary, building, and so on) so a ranked row can still be rendered.
 */
export function toRankableSpace<T extends RankableSpaceInput>(
  space: T,
  options?: RankableSpaceOptions,
): T & RankableSpace {
  const ranked: RankableSpace = isRankableSpace(space)
    ? {
        ...space,
        isOpenNow: options?.isOpenNow ?? space.isOpenNow,
        isOpenLate: options?.isOpenLate ?? space.isOpenLate,
        distanceMeters: options?.distanceMeters !== undefined ? options.distanceMeters : space.distanceMeters,
      }
    : fromRecord(space, options);
  return { ...space, ...ranked };
}
