import type { SpaceSummary } from "@/features/spaces/types";
import type { Database } from "@/types/supabase";
import { distanceToBuildingMeters, type GeoPoint } from "../location";
import type {
  BrightnessLevel,
  NiceToHaveAmenity,
  NoiseLevel,
  RankableSpace,
  RankContext,
  SpaceSetting,
  StudyPreferences,
  WhenYouStudy,
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

const NOISE_LEVELS = ["quiet", "low_noise", "conversational", "loud"] as const;

const BRIGHTNESS_FROM_STORED: Record<string, BrightnessLevel | "any"> = {
  dim: "dim",
  medium: "moderate",
  moderate: "moderate",
  bright: "bright",
  any: "any",
};

const SETTING_FROM_STORED: Record<string, SpaceSetting | "any"> = {
  enclosed: "enclosed",
  open: "open",
  any: "any",
};

// `space_feature` values and F3.1 nice-to-have names, in ranking vocabulary.
// Computers and external monitors share "monitors" (F3.1's monitors_or_computers).
const AMENITY_FROM_STORED: Record<string, NiceToHaveAmenity> = {
  outlets: "outlets",
  whiteboards: "whiteboard",
  whiteboard: "whiteboard",
  external_monitors: "monitors",
  monitors: "monitors",
  monitors_or_computers: "monitors",
  computers: "monitors",
  caen_computers: "monitors",
  printing: "near_printer",
  printer: "near_printer",
  near_printer: "near_printer",
  all_gender_restroom_on_floor: "near_restroom",
  restroom: "near_restroom",
  near_restroom: "near_restroom",
  entrance: "near_entrance",
  near_entrance: "near_entrance",
  wheelchair_accessible: "accessible",
  accessible: "accessible",
  bookable: "bookable",
};

const WHEN_FROM_STORED: Record<string, WhenYouStudy> = {
  morning: "mornings",
  mornings: "mornings",
  afternoon: "afternoons",
  afternoons: "afternoons",
  evening: "evenings",
  evenings: "evenings",
  late_night: "late_night",
};

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
  if (value === "any") return [];
  return unique(
    asStrings(value).filter((token): token is NoiseLevel => (NOISE_LEVELS as readonly string[]).includes(token)),
  );
}

function amenitiesFromStored(value: unknown): NiceToHaveAmenity[] {
  return unique(asStrings(value).flatMap((token) => AMENITY_FROM_STORED[token] ?? []));
}

function hasNaturalLight(value: unknown): boolean {
  return asStrings(value).includes("natural_light");
}

function whenFromStored(value: unknown): WhenYouStudy[] {
  return unique(asStrings(value).flatMap((token) => WHEN_FROM_STORED[token] ?? []));
}

function daylightFromStored(value: unknown): "lots" | "any" | undefined {
  if (value === "lots" || value === "any") return value;
  if (value === "some_daylight" || value === "bright_daylight" || value === "natural_light") return "lots";
  return undefined;
}

/**
 * F3.1 `settings.study` (or an already normalized preference object) → ranking preferences.
 * Quiet and low noise stay distinct. "any" and unknown values become no preference.
 */
export function toStudyPreferences(study: unknown): StudyPreferences {
  if (!study || typeof study !== "object" || Array.isArray(study)) return {};
  const record = study as Record<string, unknown>;
  const preferences: StudyPreferences = {};

  const noise = noiseFromStored(record.noise);
  if (noise.length === 1) preferences.noise = noise[0];
  else if (noise.length > 1) preferences.noise = noise;

  const setting = typeof record.setting === "string" ? SETTING_FROM_STORED[record.setting] : undefined;
  if (setting && setting !== "any") preferences.setting = setting;

  const brightnessSource = record.brightness ?? record.light ?? record.light_level;
  const brightness = typeof brightnessSource === "string" ? BRIGHTNESS_FROM_STORED[brightnessSource] : undefined;
  if (brightness && brightness !== "any") preferences.brightness = brightness;

  const daylight = daylightFromStored(record.daylight);
  if (daylight === "lots") preferences.daylight = "lots";
  else if (hasNaturalLight(record.features) || hasNaturalLight(record.niceToHave)) preferences.daylight = "lots";

  const niceToHave = amenitiesFromStored(record.niceToHave ?? record.features);
  if (niceToHave.length > 0) preferences.niceToHave = niceToHave;

  const when = whenFromStored(record.when ?? record.whenYouStudy);
  if (when.length > 0) preferences.when = when;

  return preferences;
}

/**
 * Reads F3.1 study preferences. `settings.study` wins. Until that field is
 * part of `Settings`, unknown keys land in `extras.study`, which is the fallback.
 * `extras.needs` is not a study profile.
 */
export function studyPreferencesFromSettings(
  settings: { study?: unknown } | null | undefined,
  extras?: Record<string, unknown> | null,
): StudyPreferences {
  if (settings && typeof settings === "object" && "study" in settings && settings.study != null) {
    return toStudyPreferences(settings.study);
  }
  if (extras && typeof extras === "object" && "study" in extras) return toStudyPreferences(extras.study);
  return {};
}

/**
 * Ranking context from a settings object. Saved `settings.study` fills
 * `preferences` unless the caller already passed them.
 */
export function rankContextFromSettings(
  settings: { study?: unknown } | null | undefined,
  extras?: Record<string, unknown> | null,
  context: RankContext = {},
): RankContext {
  return {
    ...context,
    preferences: context.preferences ?? studyPreferencesFromSettings(settings, extras),
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
  const mappedBrightness =
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
    brightness: mappedBrightness && mappedBrightness !== "any" ? mappedBrightness : null,
    daylight: features.includes("natural_light") ? "lots" : null,
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
