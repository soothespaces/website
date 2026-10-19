import type { GeoPoint } from "@/lib/location";

export type NoiseLevel = "silent" | "quiet" | "moderate" | "lively";
export type SpaceSetting = "enclosed" | "open";
export type BrightnessLevel = "dim" | "medium" | "bright";
export type DaylightLevel = "windowless" | "some_daylight" | "bright_daylight";
export type GroupSize = "just_me" | "2_3" | "4_plus";

export type NiceToHaveAmenity =
  | "outlets"
  | "whiteboard"
  | "external_monitors"
  | "caen_computers"
  | "near_printer"
  | "near_restroom"
  | "near_water"
  | "near_entrance"
  | "bookable";

export interface StudyPreferences {
  noise?: NoiseLevel[];
  setting?: SpaceSetting | "any";
  brightness?: BrightnessLevel | "any";
  daylight?: DaylightLevel | "any";
  niceToHave?: NiceToHaveAmenity[];
  whenYouStudy?: ("morning" | "afternoon" | "evening" | "late_night")[];
}

/**
 * F3.1 study object (`src/lib/settings/model.ts` once that ticket lands).
 * `rankSpaces` accepts this shape directly and maps it onto {@link StudyPreferences}.
 */
export interface CatalogStudyPreferences {
  noise?: "quiet" | "low_noise" | "conversational" | "any";
  setting?: "open" | "enclosed" | "any";
  brightness?: "dim" | "moderate" | "bright" | "any";
  daylight?: "lots" | "any";
  niceToHave?: (
    | "outlets"
    | "monitors_or_computers"
    | "printer"
    | "restroom"
    | "whiteboard"
    | "entrance"
    | "accessible"
  )[];
  when?: ("mornings" | "afternoons" | "evenings" | "late_night")[];
}

export type PreferenceInput =
  | StudyPreferences
  | CatalogStudyPreferences
  | { study?: StudyPreferences | CatalogStudyPreferences | null }
  | null;

/**
 * A space list row or a `spaces` table row. Fields the catalog does not store
 * yet (`isOpenNow`, `distanceMeters`, …) can be attached by the caller.
 */
export interface CatalogSpace {
  id?: string;
  slug?: string;
  name: string;
  buildingId?: string;
  building_slug?: string;
  building?: {
    slug?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  floor?: string | number | null;
  floor_label?: string | null;
  isOpenNow?: boolean;
  isOpenLate?: boolean;
  noise?: NoiseLevel | null;
  noise_level?: unknown;
  setting?: SpaceSetting | null;
  brightness?: BrightnessLevel | null;
  light_level?: unknown;
  daylight?: DaylightLevel | null;
  maxGroupSize?: GroupSize | number | null;
  capacity?: number | null;
  bookable?: boolean;
  amenities?: Partial<Record<NiceToHaveAmenity, boolean>>;
  features?: readonly unknown[] | null;
  distanceMeters?: number | null;
  lat?: number | null;
  lng?: number | null;
}

export interface RankableSpace extends CatalogSpace {
  id: string;
  buildingId: string;
}

export interface QuickFilterChips {
  quiet?: boolean;
  openLate?: boolean;
  dimLighting?: boolean;
  bookable?: boolean;
  computers?: boolean;
  printerNearby?: boolean;
  restroomNearby?: boolean;
}

export interface RankContext {
  preferences?: PreferenceInput;
  groupSize?: GroupSize;
  chips?: QuickFilterChips;
  /** Walker position. Fills `distanceMeters` when the space or its building has coordinates. */
  origin?: GeoPoint | null;
}

/** `RankContext` after catalog preferences have been mapped to {@link StudyPreferences}. */
export type NormalizedRankContext = Omit<RankContext, "preferences"> & {
  preferences?: StudyPreferences;
};

export type MatchReasonKey =
  | "silent"
  | "quiet"
  | "moderate_noise"
  | "lively"
  | "enclosed"
  | "open_area"
  | "soft_lighting"
  | "medium_lighting"
  | "bright_lighting"
  | "natural_light"
  | "windowless"
  | "solo_friendly"
  | "small_group"
  | "large_group"
  | "open_late"
  | "bookable"
  | "outlets"
  | "whiteboard"
  | "external_monitors"
  | "computers"
  | "near_printer"
  | "near_restroom"
  | "near_water"
  | "near_entrance"
  | "open_now"
  | "nearby";

export interface RankedSpace<T extends CatalogSpace = RankableSpace> {
  space: T;
  score: number;
  matchedReasons: MatchReasonKey[];
  matchesLine: string;
}
