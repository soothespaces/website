import type { Settings } from "@/lib/settings/model";
import { distanceToBuildingMeters, type GeoPoint } from "@/lib/location";
import type {
  BrightnessLevel,
  CatalogSpace,
  DaylightLevel,
  GroupSize,
  NiceToHaveAmenity,
  NoiseLevel,
  NormalizedRankContext,
  RankContext,
  RankableSpace,
  SpaceSetting,
  StudyPreferences,
} from "./types";

type WhenYouStudy = NonNullable<StudyPreferences["whenYouStudy"]>[number];

const AMENITY_ALIASES: Record<string, readonly NiceToHaveAmenity[]> = {
  outlets: ["outlets"],
  whiteboard: ["whiteboard"],
  whiteboards: ["whiteboard"],
  external_monitors: ["external_monitors"],
  monitors: ["external_monitors"],
  monitors_or_computers: ["external_monitors", "caen_computers"],
  caen_computers: ["caen_computers"],
  computers: ["caen_computers"],
  near_printer: ["near_printer"],
  printer: ["near_printer"],
  printing: ["near_printer"],
  near_restroom: ["near_restroom"],
  restroom: ["near_restroom"],
  near_water: ["near_water"],
  near_entrance: ["near_entrance"],
  entrance: ["near_entrance"],
  bookable: ["bookable"],
  // F3.1's "accessible" has no ranking amenity yet.
  accessible: [],
};

function asRecord(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  return input as Record<string, unknown>;
}

function unwrapStudy(input: unknown): Record<string, unknown> | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const study = asRecord(record.study);
  if (
    study &&
    ("noise" in study ||
      "setting" in study ||
      "brightness" in study ||
      "daylight" in study ||
      "niceToHave" in study ||
      "when" in study ||
      "whenYouStudy" in study)
  ) {
    return study;
  }
  return record;
}

function mapNoiseValue(value: unknown): NoiseLevel | undefined {
  if (value === "silent" || value === "quiet" || value === "moderate" || value === "lively") return value;
  // Catalog noise is quiet → low_noise → conversational → loud.
  // quiet and low_noise share the ranking "quiet" bucket so a quiet preference matches both.
  if (value === "low_noise") return "quiet";
  if (value === "conversational") return "moderate";
  if (value === "loud") return "lively";
  return undefined;
}

function mapSetting(value: unknown): SpaceSetting | "any" | undefined {
  if (value === "enclosed" || value === "open" || value === "any") return value;
  return undefined;
}

function mapBrightness(value: unknown): BrightnessLevel | "any" | undefined {
  if (value === "dim" || value === "medium" || value === "bright" || value === "any") return value;
  if (value === "moderate") return "medium";
  return undefined;
}

function mapDaylight(value: unknown): DaylightLevel | "any" | undefined {
  if (value === "windowless" || value === "some_daylight" || value === "bright_daylight" || value === "any") {
    return value;
  }
  if (value === "lots") return "bright_daylight";
  return undefined;
}

function mapWhen(value: unknown): WhenYouStudy | undefined {
  if (value === "morning" || value === "mornings") return "morning";
  if (value === "afternoon" || value === "afternoons") return "afternoon";
  if (value === "evening" || value === "evenings") return "evening";
  if (value === "late_night") return "late_night";
  return undefined;
}

function mapNoiseList(value: unknown): NoiseLevel[] | undefined {
  if (value == null || value === "any") return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const noise = raw.map(mapNoiseValue).filter((level): level is NoiseLevel => level != null);
  return noise.length > 0 ? noise : undefined;
}

function mapAmenities(value: unknown): NiceToHaveAmenity[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const amenities: NiceToHaveAmenity[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    for (const amenity of AMENITY_ALIASES[entry] ?? []) {
      if (!amenities.includes(amenity)) amenities.push(amenity);
    }
  }
  return amenities.length > 0 ? amenities : undefined;
}

function mapWhenList(value: unknown): WhenYouStudy[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const when = value.map(mapWhen).filter((part): part is WhenYouStudy => part != null);
  return when.length > 0 ? when : undefined;
}

/**
 * Normalizes handoff preferences, the F3.1 `study` object, or a settings
 * document that contains `study`, into the ranking preference shape.
 * Unknown values are dropped. "any" and empty lists become "no preference".
 */
export function toStudyPreferences(input: unknown): StudyPreferences {
  const source = unwrapStudy(input);
  if (!source) return {};

  const preferences: StudyPreferences = {};
  const noise = mapNoiseList(source.noise);
  const setting = mapSetting(source.setting);
  const brightness = mapBrightness(source.brightness);
  const daylight = mapDaylight(source.daylight);
  const niceToHave = mapAmenities(source.niceToHave);
  const whenYouStudy = mapWhenList(source.whenYouStudy ?? source.when);

  if (noise) preferences.noise = noise;
  if (setting && setting !== "any") preferences.setting = setting;
  if (brightness && brightness !== "any") preferences.brightness = brightness;
  if (daylight && daylight !== "any") preferences.daylight = daylight;
  if (niceToHave) preferences.niceToHave = niceToHave;
  if (whenYouStudy) preferences.whenYouStudy = whenYouStudy;
  return preferences;
}

/**
 * Reads study preferences off the settings document. Today they live in
 * `extras.study` (unknown keys stay in extras). Once F3.1 adds `settings.study`,
 * that field wins.
 */
export function studyPreferencesFromSettings(
  settings: Settings | (Settings & { study?: unknown }) | null | undefined,
  extras?: Record<string, unknown> | null,
): StudyPreferences {
  const embedded = settings && typeof settings === "object" && "study" in settings ? settings.study : undefined;
  if (embedded != null) return toStudyPreferences(embedded);
  if (extras && "study" in extras) return toStudyPreferences(extras.study);
  return {};
}

export function normalizeRankContext(context: RankContext = {}): NormalizedRankContext {
  return {
    ...context,
    preferences: context.preferences == null ? undefined : toStudyPreferences(context.preferences),
  };
}

function featureSet(features: readonly unknown[] | null | undefined): Set<string> {
  const names = new Set<string>();
  for (const feature of features ?? []) {
    if (typeof feature === "string") names.add(feature);
  }
  return names;
}

function coordinatesOf(space: CatalogSpace): GeoPoint | null {
  if (typeof space.lat === "number" && typeof space.lng === "number") {
    return { latitude: space.lat, longitude: space.lng };
  }
  const building = space.building;
  if (building && typeof building.lat === "number" && typeof building.lng === "number") {
    return { latitude: building.lat, longitude: building.lng };
  }
  return null;
}

function resolveDistance(space: CatalogSpace, origin?: RankContext["origin"]): number | null {
  if (typeof space.distanceMeters === "number" && Number.isFinite(space.distanceMeters)) {
    return space.distanceMeters;
  }
  if (!origin) return null;
  const point = coordinatesOf(space);
  if (!point) return null;
  return distanceToBuildingMeters(origin, point);
}

function isPreparedRankable(space: CatalogSpace): space is RankableSpace {
  return (
    typeof space.buildingId === "string" &&
    space.noise_level == null &&
    space.building_slug == null &&
    space.features == null &&
    space.light_level == null
  );
}

/**
 * Turns a ranking space, a `spaces` row, or a {@link CatalogSpace} list row
 * into the shape `scoreSpace` reads. Catalog noise, light, and features are
 * mapped onto the ranking vocabulary. An explicit `distanceMeters` wins;
 * otherwise `origin` plus `lat`/`lng` (or the building pin) fills it in.
 */
export function toRankableSpace(space: CatalogSpace, origin?: RankContext["origin"]): RankableSpace {
  const distanceMeters = resolveDistance(space, origin);
  if (isPreparedRankable(space)) {
    if (space.distanceMeters == null && distanceMeters != null) return { ...space, distanceMeters };
    return space;
  }

  const features = featureSet(space.features);
  const amenities: Partial<Record<NiceToHaveAmenity, boolean>> = { ...space.amenities };
  if (features.has("outlets")) amenities.outlets = true;
  if (features.has("whiteboards") || features.has("whiteboard")) amenities.whiteboard = true;
  if (features.has("external_monitors")) amenities.external_monitors = true;
  if (features.has("computers")) amenities.caen_computers = true;
  if (features.has("printing")) amenities.near_printer = true;
  if (features.has("all_gender_restroom_on_floor")) amenities.near_restroom = true;
  if (features.has("bookable")) amenities.bookable = true;

  const mappedBrightness = mapBrightness(space.brightness ?? space.light_level);
  let maxGroupSize: GroupSize | number | null = space.maxGroupSize ?? null;
  if (maxGroupSize == null && typeof space.capacity === "number") maxGroupSize = space.capacity;
  if (maxGroupSize == null && features.has("group_rooms")) maxGroupSize = "4_plus";

  return {
    id: space.id ?? space.slug ?? space.name,
    name: space.name,
    buildingId: space.building_slug ?? space.building?.slug ?? "",
    floor: space.floor ?? space.floor_label ?? null,
    isOpenNow: space.isOpenNow,
    isOpenLate: space.isOpenLate,
    noise: space.noise ?? mapNoiseValue(space.noise_level) ?? null,
    setting: space.setting ?? null,
    brightness: mappedBrightness && mappedBrightness !== "any" ? mappedBrightness : null,
    daylight: space.daylight ?? (features.has("natural_light") ? "bright_daylight" : null),
    maxGroupSize,
    bookable: Boolean(space.bookable || amenities.bookable),
    amenities,
    distanceMeters,
  };
}

export function sortableDistance(space: CatalogSpace, origin?: RankContext["origin"]): number {
  const meters = toRankableSpace(space, origin).distanceMeters;
  return typeof meters === "number" && Number.isFinite(meters) ? meters : Number.POSITIVE_INFINITY;
}
