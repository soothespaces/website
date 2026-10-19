import type { SpaceSummary } from "@/features/spaces/types";
import type { Database } from "@/types/supabase";
import { normalizeRankContext, sortableDistance, toRankableSpace } from "./adapt";
import type {
  CatalogSpace,
  MatchReasonKey,
  NiceToHaveAmenity,
  NoiseLevel,
  RankContext,
  RankableSpace,
  RankedSpace,
} from "./types";

export type {
  BrightnessLevel,
  CatalogSpace,
  CatalogStudyPreferences,
  DaylightLevel,
  GroupSize,
  MatchReasonKey,
  NiceToHaveAmenity,
  NoiseLevel,
  PreferenceInput,
  QuickFilterChips,
  RankableSpace,
  RankContext,
  RankedSpace,
  SpaceSetting,
  StudyPreferences,
} from "./types";

export { studyPreferencesFromSettings, toRankableSpace, toStudyPreferences } from "./adapt";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

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

// Noise, then lighting, daylight, setting, group fit, then nice-to-haves.
const MATCH_REASON_PRIORITY: Record<MatchReasonKey, number> = {
  silent: 0,
  quiet: 1,
  moderate_noise: 2,
  lively: 3,
  soft_lighting: 4,
  medium_lighting: 5,
  bright_lighting: 6,
  natural_light: 7,
  windowless: 8,
  enclosed: 9,
  open_area: 10,
  solo_friendly: 11,
  small_group: 12,
  large_group: 13,
  outlets: 14,
  external_monitors: 15,
  computers: 16,
  near_printer: 17,
  near_restroom: 18,
  whiteboard: 19,
  near_water: 20,
  near_entrance: 21,
  bookable: 22,
  open_late: 23,
  open_now: 24,
  nearby: 25,
};

/** Tunable score weights. Preferences sort; they never remove a space. */
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

const NOISE_ORDER: NoiseLevel[] = ["silent", "quiet", "moderate", "lively"];

function getNoiseDistance(a: NoiseLevel, b: NoiseLevel): number {
  return Math.abs(NOISE_ORDER.indexOf(a) - NOISE_ORDER.indexOf(b));
}

function supportsGroupSize(space: RankableSpace, requested: NonNullable<RankContext["groupSize"]>): boolean {
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
 * Keeps the incoming order. Returns "" when nothing matched.
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
 * F3.5: same sentence as {@link formatMatchesLine}, but reasons are ordered
 * noise → lighting → daylight → setting → group → nice-to-haves, capped at
 * three. Returns null when nothing matched so the line can be hidden.
 */
export function matchesLine(reasons: readonly MatchReasonKey[], maxItems = 3): string | null {
  const unique = Array.from(new Set(reasons)).sort(
    (a, b) => MATCH_REASON_PRIORITY[a] - MATCH_REASON_PRIORITY[b],
  );
  const line = formatMatchesLine(unique, maxItems);
  return line === "" ? null : line;
}

/**
 * Scores a single space against user preferences, group size, active chips,
 * open status, and walking distance.
 */
export function scoreSpace<T extends CatalogSpace>(space: T, context: RankContext = {}): RankedSpace<T> {
  const normalized = normalizeRankContext(context);
  const view = toRankableSpace(space, normalized.origin);
  const { preferences, groupSize, chips } = normalized;
  let score = 0;
  const reasons: MatchReasonKey[] = [];

  // 1. Open now (prioritized so closed spaces sink to the bottom, but never filtered out)
  if (view.isOpenNow !== false) {
    if (view.isOpenNow === true) {
      score += WEIGHTS.OPEN_NOW;
    }
  } else {
    score -= WEIGHTS.OPEN_NOW;
  }

  // 2. Quick-toggle chips & Noise preferences
  const wantsQuietChip = Boolean(chips?.quiet);
  const preferredNoise = preferences?.noise ?? [];

  if (view.noise) {
    const noise = view.noise;
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

  // 3. Brightness chip & preference
  const wantsDimChip = Boolean(chips?.dimLighting);
  const preferredBrightness =
    preferences?.brightness && preferences.brightness !== "any" ? preferences.brightness : undefined;

  if (view.brightness) {
    if (wantsDimChip && view.brightness === "dim") {
      score += WEIGHTS.CHIP_MATCH;
      reasons.push("soft_lighting");
    } else if (preferredBrightness && view.brightness === preferredBrightness) {
      score += WEIGHTS.BRIGHTNESS;
      if (view.brightness === "dim") reasons.push("soft_lighting");
      else if (view.brightness === "medium") reasons.push("medium_lighting");
      else reasons.push("bright_lighting");
    }
  }

  // 4. Setting preference (enclosed vs open)
  if (preferences?.setting && preferences.setting !== "any" && view.setting === preferences.setting) {
    score += WEIGHTS.SETTING;
    reasons.push(view.setting === "enclosed" ? "enclosed" : "open_area");
  }

  // 5. Daylight preference
  if (preferences?.daylight && preferences.daylight !== "any" && view.daylight === preferences.daylight) {
    score += WEIGHTS.DAYLIGHT;
    if (view.daylight === "windowless") {
      reasons.push("windowless");
    } else {
      reasons.push("natural_light");
    }
  }

  // 6. Group size ("Just me", "2–3", "4+")
  if (groupSize && supportsGroupSize(view, groupSize)) {
    score += WEIGHTS.GROUP_SIZE;
    if (groupSize === "just_me") reasons.push("solo_friendly");
    else if (groupSize === "2_3") reasons.push("small_group");
    else reasons.push("large_group");
  }

  // 7. Quick chips: Open late, Bookable, Computers, Printer, Restroom
  if (chips?.openLate && view.isOpenLate) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("open_late");
  } else if (preferences?.whenYouStudy?.includes("late_night") && view.isOpenLate) {
    score += WEIGHTS.NICE_TO_HAVE;
    reasons.push("open_late");
  }

  const isBookable = Boolean(view.bookable || view.amenities?.bookable);
  if (chips?.bookable && isBookable) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("bookable");
  }

  if (chips?.computers && view.amenities?.caen_computers) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("computers");
  }

  if (chips?.printerNearby && view.amenities?.near_printer) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("near_printer");
  }

  if (chips?.restroomNearby && view.amenities?.near_restroom) {
    score += WEIGHTS.CHIP_MATCH;
    reasons.push("near_restroom");
  }

  // 8. Nice-to-have amenities from preferences
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
    const hasAmenity = amenity === "bookable" ? isBookable : Boolean(view.amenities?.[amenity]);
    if (hasAmenity) {
      score += WEIGHTS.NICE_TO_HAVE;
      reasons.push(amenityReasonMap[amenity]);
    }
  }

  // 9. Walking distance bonus
  if (typeof view.distanceMeters === "number" && Number.isFinite(view.distanceMeters) && view.distanceMeters >= 0) {
    const distanceBonus = WEIGHTS.DISTANCE_MAX_BONUS * Math.exp(-view.distanceMeters / 430);
    score += distanceBonus;
    if (view.distanceMeters <= 250) {
      reasons.push("nearby");
    }
  }

  // Fallback descriptive reasons if user has no active filters/preferences yet
  if (reasons.length === 0) {
    if (view.noise === "silent" || view.noise === "quiet") {
      reasons.push(view.noise);
    }
    if (view.brightness === "dim") {
      reasons.push("soft_lighting");
    }
    if (view.amenities?.near_printer) {
      reasons.push("near_printer");
    }
    if (view.isOpenNow) {
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
 * Never filters any space out—returns a new array of the exact same length.
 *
 * `T` may be a {@link RankableSpace} or a catalog row (`SpaceSummary` or a
 * `spaces` table row). Preferences may be the ranking shape or the F3.1
 * `study` object.
 */
export function rankSpaces<T extends CatalogSpace>(spaces: readonly T[], context: RankContext = {}): RankedSpace<T>[] {
  const normalized = normalizeRankContext(context);
  return spaces
    .map((space, originalIndex) => ({
      ranked: scoreSpace(space, normalized),
      originalIndex,
    }))
    .sort((a, b) => {
      if (b.ranked.score !== a.ranked.score) {
        return b.ranked.score - a.ranked.score;
      }
      const distA = sortableDistance(a.ranked.space, normalized.origin);
      const distB = sortableDistance(b.ranked.space, normalized.origin);
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

/** Space list rows (`SpaceSummary`) passed straight into ranking. */
export function rankSpaceSummaries(spaces: readonly SpaceSummary[], context: RankContext = {}) {
  return rankSpaces(spaces, context);
}

/** `spaces` table rows passed straight into ranking. */
export function rankSpaceRows(spaces: readonly SpaceRow[], context: RankContext = {}) {
  return rankSpaces(spaces, context);
}
