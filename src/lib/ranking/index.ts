import { toRankableSpace, type RankableSpaceInput, type RankableSpaceOptions } from "./adapt";

export type { RankableSpaceInput, RankableSpaceOptions } from "./adapt";
export { rankContextFromSettings, studyPreferencesFromNeeds, toRankableSpace } from "./adapt";

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

export interface RankableSpace {
  id: string;
  name: string;
  buildingId: string;
  floor?: string | number | null;
  isOpenNow?: boolean;
  isOpenLate?: boolean;
  noise?: NoiseLevel | null;
  setting?: SpaceSetting | null;
  brightness?: BrightnessLevel | null;
  daylight?: DaylightLevel | null;
  maxGroupSize?: GroupSize | number | null;
  bookable?: boolean;
  amenities?: Partial<Record<NiceToHaveAmenity, boolean>>;
  distanceMeters?: number | null;
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
  preferences?: StudyPreferences;
  groupSize?: GroupSize;
  chips?: QuickFilterChips;
}

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

export interface RankedSpace<T extends RankableSpace = RankableSpace> {
  space: T;
  score: number;
  matchedReasons: MatchReasonKey[];
  matchesLine: string;
}

const MATCH_REASON_LABELS: Record<MatchReasonKey, string> = {
  silent: "silent",
  quiet: "quiet",
  moderate_noise: "moderate noise",
  lively: "lively",
  enclosed: "enclosed",
  open_area: "open room",
  soft_lighting: "soft lighting",
  medium_lighting: "medium lighting",
  bright_lighting: "bright lighting",
  natural_light: "natural light",
  windowless: "no windows",
  solo_friendly: "good for solo study",
  small_group: "fits 2–3",
  large_group: "fits 4+",
  open_late: "open late",
  bookable: "bookable",
  outlets: "outlets",
  whiteboard: "whiteboard",
  external_monitors: "monitors",
  computers: "CAEN computers",
  near_printer: "near a printer",
  near_restroom: "near a restroom",
  near_water: "near water",
  near_entrance: "near an entrance",
  open_now: "open now",
  nearby: "nearby",
};

const WEIGHTS = {
  OPEN_NOW: 100,
  CHIP_MATCH: 35,
  NOISE_EXACT: 30,
  NOISE_ADJACENT: 12,
  GROUP_SIZE: 25,
  SETTING: 20,
  BRIGHTNESS: 20,
  DAYLIGHT: 15,
  NICE_TO_HAVE: 12,
  DISTANCE_MAX_BONUS: 18,
} as const;

const NOISE_ORDER: NoiseLevel[] = ["silent", "quiet", "moderate", "lively"];

function getNoiseDistance(a: NoiseLevel, b: NoiseLevel): number {
  return Math.abs(NOISE_ORDER.indexOf(a) - NOISE_ORDER.indexOf(b));
}

function supportsGroupSize(space: RankableSpace, requested: GroupSize): boolean {
  const cap = space.maxGroupSize;
  if (typeof cap === "number") {
    if (requested === "just_me") return cap >= 1;
    if (requested === "2_3") return cap >= 2;
    return cap >= 4;
  }
  if (typeof cap === "string") {
    if (requested === "just_me") return true;
    if (requested === "2_3") return cap === "2_3" || cap === "4_plus";
    return cap === "4_plus";
  }
  if (requested === "just_me") {
    return space.noise === "silent" || space.noise === "quiet";
  }
  if (requested === "2_3") {
    return space.noise === "moderate" || space.noise === "lively" || Boolean(space.bookable);
  }
  return space.noise === "lively" || Boolean(space.bookable);
}

/**
 * F3.5 (SOS-121): Formats the "Matches: quiet · soft lighting · near a printer"
 * explainer string from a list of matched reason keys.
 */
export function formatMatchesLine(reasons: readonly MatchReasonKey[], maxItems = 3): string {
  const uniqueReasons = Array.from(new Set(reasons));
  const selected = uniqueReasons.slice(0, Math.max(1, maxItems));
  if (selected.length === 0) {
    return "";
  }
  const labels = selected.map((key) => MATCH_REASON_LABELS[key]);
  return `Matches: ${labels.join(" · ")}`;
}

/**
 * Scores a single space against user preferences, group size, active chips,
 * open status, and walking distance.
 */
export function scoreSpace<T extends RankableSpace>(space: T, context: RankContext = {}): RankedSpace<T> {
  const { preferences, groupSize, chips } = context;
  let score = 0;
  const reasons: MatchReasonKey[] = [];

  // Open now is prioritized so closed spaces sink, and nothing is removed.
  if (space.isOpenNow !== false) {
    if (space.isOpenNow === true) {
      score += WEIGHTS.OPEN_NOW;
    }
  } else {
    score -= WEIGHTS.OPEN_NOW;
  }

  const wantsQuietChip = Boolean(chips?.quiet);
  const preferredNoise = preferences?.noise ?? [];
  const noise = space.noise;

  if (noise) {
    const isQuietOrSilent = noise === "silent" || noise === "quiet";
    if (wantsQuietChip && isQuietOrSilent) {
      score += WEIGHTS.CHIP_MATCH;
      reasons.push(noise === "silent" ? "silent" : "quiet");
    } else if (preferredNoise.includes(noise)) {
      score += WEIGHTS.NOISE_EXACT;
      reasons.push(noise === "moderate" ? "moderate_noise" : noise);
    } else if (preferredNoise.length > 0) {
      const minDistance = Math.min(...preferredNoise.map((target) => getNoiseDistance(noise, target)));
      if (minDistance === 1) {
        score += WEIGHTS.NOISE_ADJACENT;
      }
    }
  }

  const wantsDimChip = Boolean(chips?.dimLighting);
  const preferredBrightness =
    preferences?.brightness && preferences.brightness !== "any" ? preferences.brightness : undefined;

  if (space.brightness) {
    if (wantsDimChip && space.brightness === "dim") {
      score += WEIGHTS.CHIP_MATCH;
      reasons.push("soft_lighting");
    } else if (preferredBrightness && space.brightness === preferredBrightness) {
      score += WEIGHTS.BRIGHTNESS;
      if (space.brightness === "dim") reasons.push("soft_lighting");
      else if (space.brightness === "medium") reasons.push("medium_lighting");
      else reasons.push("bright_lighting");
    }
  }

  if (preferences?.setting && preferences.setting !== "any" && space.setting === preferences.setting) {
    score += WEIGHTS.SETTING;
    reasons.push(space.setting === "enclosed" ? "enclosed" : "open_area");
  }

  if (preferences?.daylight && preferences.daylight !== "any" && space.daylight === preferences.daylight) {
    score += WEIGHTS.DAYLIGHT;
    if (space.daylight === "windowless") {
      reasons.push("windowless");
    } else {
      reasons.push("natural_light");
    }
  }

  if (groupSize && supportsGroupSize(space, groupSize)) {
    score += WEIGHTS.GROUP_SIZE;
    if (groupSize === "just_me") reasons.push("solo_friendly");
    else if (groupSize === "2_3") reasons.push("small_group");
    else reasons.push("large_group");
  }

  if (chips?.openLate && space.isOpenLate) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("open_late");
  } else if (preferences?.whenYouStudy?.includes("late_night") && space.isOpenLate) {
    score += WEIGHTS.NICE_TO_HAVE;
    reasons.push("open_late");
  }

  const isBookable = Boolean(space.bookable || space.amenities?.bookable);
  if (chips?.bookable && isBookable) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("bookable");
  }

  if (chips?.computers && space.amenities?.caen_computers) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("computers");
  }

  if (chips?.printerNearby && space.amenities?.near_printer) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("near_printer");
  }

  if (chips?.restroomNearby && space.amenities?.near_restroom) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("near_restroom");
  }

  const niceToHave = preferences?.niceToHave ?? [];
  const amenityReasonMap: Record<NiceToHaveAmenity, MatchReasonKey> = {
    outlets: "outlets",
    whiteboard: "whiteboard",
    external_monitors: "external_monitors",
    caen_computers: "computers",
    near_printer: "near_printer",
    near_restroom: "near_restroom",
    near_water: "near_water",
    near_entrance: "near_entrance",
    bookable: "bookable",
  };

  for (const amenity of niceToHave) {
    const hasAmenity = amenity === "bookable" ? isBookable : Boolean(space.amenities?.[amenity]);
    if (hasAmenity) {
      score += WEIGHTS.NICE_TO_HAVE;
      reasons.push(amenityReasonMap[amenity]);
    }
  }

  if (
    typeof space.distanceMeters === "number" &&
    Number.isFinite(space.distanceMeters) &&
    space.distanceMeters >= 0
  ) {
    const distanceBonus = WEIGHTS.DISTANCE_MAX_BONUS * Math.exp(-space.distanceMeters / 430);
    score += distanceBonus;
    if (space.distanceMeters <= 250) {
      reasons.push("nearby");
    }
  }

  // With no active match yet, still describe the space from what we know.
  if (reasons.length === 0) {
    if (noise === "silent" || noise === "quiet") {
      reasons.push(noise);
    }
    if (space.brightness === "dim") {
      reasons.push("soft_lighting");
    }
    if (space.amenities?.near_printer) {
      reasons.push("near_printer");
    }
    if (space.isOpenNow) {
      reasons.push("open_now");
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));

  return {
    space,
    score,
    matchedReasons: uniqueReasons,
    matchesLine: formatMatchesLine(uniqueReasons),
  };
}

/**
 * F3.4 (SOS-114): Sorts spaces by preferences, group size, open now, and distance.
 * Never filters any space out — returns a new array of the exact same length.
 */
export function rankSpaces<T extends RankableSpace>(
  spaces: readonly T[],
  context: RankContext = {},
): RankedSpace<T>[] {
  return spaces
    .map((space, originalIndex) => ({
      ranked: scoreSpace(space, context),
      originalIndex,
    }))
    .sort((a, b) => {
      if (b.ranked.score !== a.ranked.score) {
        return b.ranked.score - a.ranked.score;
      }
      const distA = a.ranked.space.distanceMeters ?? Number.POSITIVE_INFINITY;
      const distB = b.ranked.space.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (distA !== distB) {
        return distA - distB;
      }
      const nameCompare = a.ranked.space.name.localeCompare(b.ranked.space.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.ranked);
}

/**
 * Ranks list rows and `spaces` records. Same length as `spaces`.
 * Each result keeps the original record plus the ranking fields.
 * Per-space open status and the user's position go in `options`.
 */
export function rankSpaceRecords<T extends RankableSpaceInput>(
  spaces: readonly T[],
  context: RankContext = {},
  options?: RankableSpaceOptions | ((space: T, index: number) => RankableSpaceOptions | undefined),
): RankedSpace<T & RankableSpace>[] {
  return rankSpaces(
    spaces.map((space, index) =>
      toRankableSpace(space, typeof options === "function" ? options(space, index) : options),
    ),
    context,
  );
}
