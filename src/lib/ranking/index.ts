import {
  toRankableSpace,
  toStudyPreferences,
  type RankableSpaceInput,
  type RankableSpaceOptions,
} from "./adapt";

export type { RankableSpaceInput, RankableSpaceOptions } from "./adapt";
export {
  rankContextFromSettings,
  studyPreferencesFromSettings,
  toRankableSpace,
  toStudyPreferences,
} from "./adapt";

/** Same four levels as `spaces.noise_level` and F3.1's noise preference. */
export type NoiseLevel = "quiet" | "low_noise" | "conversational" | "loud";
export type SpaceSetting = "enclosed" | "open";
/** Same three levels as `spaces.light_level` and F3.1's brightness preference. */
export type BrightnessLevel = "dim" | "moderate" | "bright";
/** F3.1 daylight is "lots" or "any". A space with natural light is "lots". */
export type DaylightLevel = "lots";
export type GroupSize = "just_me" | "2_3" | "4_plus";
export type WhenYouStudy = "mornings" | "afternoons" | "evenings" | "late_night";

export type NiceToHaveAmenity =
  | "outlets"
  | "whiteboard"
  | "monitors"
  | "near_printer"
  | "near_restroom"
  | "near_entrance"
  | "accessible"
  | "bookable";

/**
 * F3.1 `settings.study`, or the same fields already normalized.
 * `noise` is one choice on the preferences screen and may also be a list.
 */
export interface StudyPreferences {
  noise?: NoiseLevel | NoiseLevel[] | "any";
  setting?: SpaceSetting | "any";
  brightness?: BrightnessLevel | "any";
  daylight?: DaylightLevel | "any";
  niceToHave?: readonly string[];
  when?: readonly string[];
  /** Older name for {@link StudyPreferences.when}. */
  whenYouStudy?: readonly string[];
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
  | "quiet"
  | "low_noise"
  | "conversational"
  | "loud"
  | "enclosed"
  | "open_area"
  | "soft_lighting"
  | "moderate_lighting"
  | "bright"
  | "lots_of_daylight"
  | "fits_group"
  | "open_late"
  | "bookable"
  | "outlets"
  | "whiteboard"
  | "monitors"
  | "near_printer"
  | "restroom"
  | "near_entrance"
  | "accessible"
  | "open_now"
  | "nearby";

export interface RankedSpace<T extends RankableSpace = RankableSpace> {
  space: T;
  score: number;
  matchedReasons: MatchReasonKey[];
  /** Null when nothing the user asked for matched, so the line stays hidden. */
  matchesLine: string | null;
}

const MATCH_REASON_LABELS: Record<MatchReasonKey, string> = {
  quiet: "quiet",
  low_noise: "low noise",
  conversational: "conversational",
  loud: "loud",
  enclosed: "enclosed",
  open_area: "open room",
  soft_lighting: "soft lighting",
  moderate_lighting: "moderate",
  bright: "bright",
  lots_of_daylight: "lots of daylight",
  fits_group: "fits your group",
  open_late: "open late",
  bookable: "bookable",
  outlets: "outlets",
  whiteboard: "whiteboard",
  monitors: "monitors",
  near_printer: "near a printer",
  restroom: "restroom nearby",
  near_entrance: "near an entrance",
  accessible: "accessible",
  open_now: "open now",
  nearby: "nearby",
};

/**
 * SOS-121 order: noise, lighting, daylight, setting, group, then nice-to-haves.
 * Open now, nearby, and other non-preference signals stay out of the sentence.
 */
const MATCH_LINE_ORDER: readonly MatchReasonKey[] = [
  "quiet",
  "low_noise",
  "conversational",
  "soft_lighting",
  "bright",
  "lots_of_daylight",
  "enclosed",
  "open_area",
  "fits_group",
  "outlets",
  "monitors",
  "near_printer",
  "restroom",
  "whiteboard",
  "near_entrance",
  "accessible",
];

export const WEIGHTS = {
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

const NOISE_ORDER: NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];

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
    return space.noise === "quiet" || space.noise === "low_noise";
  }
  if (requested === "2_3") {
    return space.noise === "conversational" || space.noise === "loud" || Boolean(space.bookable);
  }
  return space.noise === "loud" || Boolean(space.bookable);
}

function noiseLevels(noise: StudyPreferences["noise"]): NoiseLevel[] {
  if (!noise || noise === "any") return [];
  const values = Array.isArray(noise) ? noise : [noise];
  return values.filter((level): level is NoiseLevel => NOISE_ORDER.includes(level));
}

/**
 * F3.5 (SOS-121): "Matches: quiet · soft lighting · near a printer".
 * At most three phrases, in priority order. Null when nothing matched.
 */
export function matchesLine(reasons: readonly MatchReasonKey[], maxItems = 3): string | null {
  const present = new Set(reasons);
  const labels: string[] = [];
  for (const key of MATCH_LINE_ORDER) {
    if (!present.has(key)) continue;
    labels.push(MATCH_REASON_LABELS[key]);
    if (labels.length >= Math.max(1, maxItems)) break;
  }
  if (labels.length === 0) return null;
  return `Matches: ${labels.join(" · ")}`;
}

/** Same sentence as {@link matchesLine}. */
export function formatMatchesLine(reasons: readonly MatchReasonKey[], maxItems = 3): string | null {
  return matchesLine(reasons, maxItems);
}

/**
 * Scores a single space against user preferences, group size, active chips,
 * open status, and walking distance.
 */
export function scoreSpace<T extends RankableSpace>(space: T, context: RankContext = {}): RankedSpace<T> {
  const { groupSize, chips } = context;
  const preferences = toStudyPreferences(context.preferences);
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
  const preferredNoise = noiseLevels(preferences.noise);
  const noise = space.noise;

  if (noise) {
    if (wantsQuietChip && noise === "quiet") {
      score += WEIGHTS.CHIP_MATCH;
      reasons.push("quiet");
    } else if (preferredNoise.includes(noise)) {
      score += WEIGHTS.NOISE_EXACT;
      reasons.push(noise);
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
      else if (space.brightness === "bright") reasons.push("bright");
      else reasons.push("moderate_lighting");
    }
  }

  if (preferences?.setting && preferences.setting !== "any" && space.setting === preferences.setting) {
    score += WEIGHTS.SETTING;
    reasons.push(space.setting === "enclosed" ? "enclosed" : "open_area");
  }

  if (preferences.daylight === "lots" && space.daylight === "lots") {
    score += WEIGHTS.DAYLIGHT;
    reasons.push("lots_of_daylight");
  }

  if (groupSize && supportsGroupSize(space, groupSize)) {
    score += WEIGHTS.GROUP_SIZE;
    reasons.push("fits_group");
  }

  const wantsLate = preferences.when?.includes("late_night") || preferences.whenYouStudy?.includes("late_night");
  if (chips?.openLate && space.isOpenLate) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("open_late");
  } else if (wantsLate && space.isOpenLate) {
    score += WEIGHTS.NICE_TO_HAVE;
    reasons.push("open_late");
  }

  const isBookable = Boolean(space.bookable || space.amenities?.bookable);
  if (chips?.bookable && isBookable) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("bookable");
  }

  if (chips?.computers && space.amenities?.monitors) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("monitors");
  }

  if (chips?.printerNearby && space.amenities?.near_printer) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("near_printer");
  }

  if (chips?.restroomNearby && space.amenities?.near_restroom) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("restroom");
  }

  const niceToHave = preferences.niceToHave ?? [];
  const amenityReasonMap: Record<NiceToHaveAmenity, MatchReasonKey> = {
    outlets: "outlets",
    whiteboard: "whiteboard",
    monitors: "monitors",
    near_printer: "near_printer",
    near_restroom: "restroom",
    near_entrance: "near_entrance",
    accessible: "accessible",
    bookable: "bookable",
  };

  for (const amenity of niceToHave) {
    if (!(amenity in amenityReasonMap)) continue;
    const key = amenity as NiceToHaveAmenity;
    const hasAmenity = key === "bookable" ? isBookable : Boolean(space.amenities?.[key]);
    if (hasAmenity) {
      score += WEIGHTS.NICE_TO_HAVE;
      reasons.push(amenityReasonMap[key]);
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

  const uniqueReasons = Array.from(new Set(reasons));

  return {
    space,
    score,
    matchedReasons: uniqueReasons,
    matchesLine: matchesLine(uniqueReasons),
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
