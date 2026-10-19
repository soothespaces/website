import type { CheckInSummary, LightLevel, NoiseLevel, SpaceFeature } from "./check-ins";
import type { Database } from "@/types/supabase";

type SpaceSource = Database["public"]["Enums"]["space_source"];

/**
 * Check-in consensus needs this many people giving the same answer.
 * Below that, one or two visits must not speak for the space.
 */
export const CHECK_IN_CONSENSUS_MIN = 3;

/** Copy from the Reports board, plus the floor-plan and edited labels the resolver needs. */
export const SOURCE_LABELS = {
  library: "From the U-M Library",
  mguide: "From MGuide",
  checkIns: "From check-ins",
  confirmedLibrary: "U-M Library · confirmed in check-ins",
  confirmedMguide: "MGuide · confirmed in check-ins",
  floorPlan: "From the floor plan",
  edited: "Edited",
  added: "Added here",
  confirmedAdded: "Added here · confirmed in check-ins",
} as const;

export type AttributeSource = "admin" | "check_ins" | "listing" | "floor_plan";

export type ResolvedValue = {
  value: string;
  source: AttributeSource;
  sourceLabel: string;
  /** True when check-ins agree with the library or MGuide listing. */
  confirmed: boolean;
};

export type AttributeSpace = {
  noiseLevel: NoiseLevel | null;
  lightLevel: LightLevel | null;
  features: readonly SpaceFeature[];
  capacity: number | null;
  source: SpaceSource;
  /** Column names a person changed, as stored on `spaces.edited_fields`. */
  editedFields: readonly string[];
  /** From a floor-plan polygon: true is an enclosed room, false is an open area. */
  enclosed?: boolean | null;
};

export type ResolvedAttributes = {
  noise: ResolvedValue | null;
  brightness: ResolvedValue | null;
  daylight: ResolvedValue | null;
  /**
   * One line for both light facts. Mixed sources read
   * "Daylight: U-M Library · Brightness: check-ins".
   */
  lightingLabel: string | null;
  seating: ResolvedValue | null;
  setting: ResolvedValue | null;
  outlets: ResolvedValue | null;
  features: Record<SpaceFeature, ResolvedValue | null>;
};

const NOISE_LABELS: Record<NoiseLevel, string> = {
  quiet: "Quiet",
  low_noise: "Low noise",
  conversational: "Conversational",
  loud: "Loud",
};

const LIGHT_LABELS: Record<LightLevel, string> = {
  dim: "Dim",
  moderate: "Moderate",
  bright: "Bright",
};

const FEATURE_LABELS: Record<SpaceFeature, string> = {
  natural_light: "Natural light",
  wheelchair_accessible: "Wheelchair accessible",
  all_gender_restroom_on_floor: "All-gender restroom",
  whiteboards: "Whiteboards",
  bookable: "Bookable",
  external_monitors: "Monitors",
  outlets: "Outlets",
  computers: "Computers",
  printing: "Printing",
  scanners: "Scanners",
  group_rooms: "Group rooms",
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as SpaceFeature[];

function consensus<T extends string>(counts: Partial<Record<T, number>> | undefined): T | null {
  if (!counts) return null;
  let best: T | null = null;
  let bestCount = 0;
  let tie = false;
  for (const [key, count] of Object.entries(counts) as [T, number][]) {
    if (!Number.isFinite(count) || count < CHECK_IN_CONSENSUS_MIN) continue;
    if (count > bestCount) {
      best = key;
      bestCount = count;
      tie = false;
    } else if (count === bestCount) tie = true;
  }
  return tie ? null : best;
}

function listingLabels(source: SpaceSource): { label: string; confirmed: string } | null {
  if (source === "um_library") return { label: SOURCE_LABELS.library, confirmed: SOURCE_LABELS.confirmedLibrary };
  if (source === "mguide") return { label: SOURCE_LABELS.mguide, confirmed: SOURCE_LABELS.confirmedMguide };
  if (source === "manual") return { label: SOURCE_LABELS.added, confirmed: SOURCE_LABELS.confirmedAdded };
  return null;
}

function resolveChoice<T extends string>(options: {
  edited: boolean;
  adminValue: T | null;
  checkIn: T | null;
  listingValue: T | null;
  listing: { label: string; confirmed: string } | null;
  format: (value: T) => string;
}): ResolvedValue | null {
  if (options.edited) {
    if (options.adminValue == null) return null;
    return { value: options.format(options.adminValue), source: "admin", sourceLabel: SOURCE_LABELS.edited, confirmed: false };
  }
  if (options.checkIn && options.listingValue === options.checkIn && options.listing) {
    return { value: options.format(options.checkIn), source: "check_ins", sourceLabel: options.listing.confirmed, confirmed: true };
  }
  if (options.checkIn) {
    return { value: options.format(options.checkIn), source: "check_ins", sourceLabel: SOURCE_LABELS.checkIns, confirmed: false };
  }
  if (options.listingValue != null && options.listing) {
    return { value: options.format(options.listingValue), source: "listing", sourceLabel: options.listing.label, confirmed: false };
  }
  return null;
}

function shortSource(resolved: ResolvedValue, source: SpaceSource): string {
  if (resolved.source === "check_ins" && !resolved.confirmed) return "check-ins";
  if (resolved.source === "admin") return "edited";
  if (resolved.source === "floor_plan") return "the floor plan";
  if (source === "mguide") return "MGuide";
  if (source === "manual") return "Added here";
  return "U-M Library";
}

function lightingLabel(brightness: ResolvedValue | null, daylight: ResolvedValue | null, source: SpaceSource): string | null {
  if (brightness && daylight) {
    const day = shortSource(daylight, source);
    const bright = shortSource(brightness, source);
    if (day !== bright) return `Daylight: ${day} · Brightness: ${bright}`;
    return daylight.sourceLabel;
  }
  return brightness?.sourceLabel ?? daylight?.sourceLabel ?? null;
}

function seatsLabel(count: number): string {
  return count === 1 ? "1 seat" : `${count} seats`;
}

/**
 * One value per attribute. An admin edit wins, then check-in consensus
 * (at least {@link CHECK_IN_CONSENSUS_MIN} agreeing), then the seed listing
 * when `source` is the library or MGuide. Missing values are null.
 */
export function resolveAttributes(space: AttributeSpace, checkInSummary: CheckInSummary | null): ResolvedAttributes {
  const listing = listingLabels(space.source);
  const handEdited = new Set(space.editedFields);

  const noise = resolveChoice({
    edited: handEdited.has("noise_level"),
    adminValue: space.noiseLevel,
    checkIn: consensus(checkInSummary?.noise),
    listingValue: space.noiseLevel,
    listing,
    format: (value) => NOISE_LABELS[value],
  });

  const brightness = resolveChoice({
    edited: handEdited.has("light_level"),
    adminValue: space.lightLevel,
    checkIn: consensus(checkInSummary?.light),
    listingValue: space.lightLevel,
    listing,
    format: (value) => LIGHT_LABELS[value],
  });

  const featuresEdited = handEdited.has("features");
  const featureSet = new Set(space.features);
  const features = {} as Record<SpaceFeature, ResolvedValue | null>;
  for (const feature of FEATURE_KEYS) {
    const listed = featureSet.has(feature);
    const checkInCount = checkInSummary?.features[feature] ?? 0;
    const fromCheckIns = checkInCount >= CHECK_IN_CONSENSUS_MIN;
    if (featuresEdited) {
      features[feature] = listed
        ? { value: FEATURE_LABELS[feature], source: "admin", sourceLabel: SOURCE_LABELS.edited, confirmed: false }
        : null;
      continue;
    }
    if (fromCheckIns && listed && listing) {
      features[feature] = { value: FEATURE_LABELS[feature], source: "check_ins", sourceLabel: listing.confirmed, confirmed: true };
    } else if (fromCheckIns) {
      features[feature] = { value: FEATURE_LABELS[feature], source: "check_ins", sourceLabel: SOURCE_LABELS.checkIns, confirmed: false };
    } else if (listed && listing) {
      features[feature] = { value: FEATURE_LABELS[feature], source: "listing", sourceLabel: listing.label, confirmed: false };
    } else {
      features[feature] = null;
    }
  }

  // The summary only counts "yes" for daylight, so a few yeses can't remove a listing.
  if (!featuresEdited && features.natural_light == null && (checkInSummary?.naturalLight ?? 0) >= CHECK_IN_CONSENSUS_MIN) {
    features.natural_light = {
      value: FEATURE_LABELS.natural_light,
      source: "check_ins",
      sourceLabel: SOURCE_LABELS.checkIns,
      confirmed: false,
    };
  }

  const seatingEdited = handEdited.has("capacity");
  const seating: ResolvedValue | null = seatingEdited
    ? space.capacity == null
      ? null
      : { value: seatsLabel(space.capacity), source: "admin", sourceLabel: SOURCE_LABELS.edited, confirmed: false }
    : space.capacity != null && listing
      ? { value: seatsLabel(space.capacity), source: "listing", sourceLabel: listing.label, confirmed: false }
      : null;

  const setting =
    space.enclosed == null
      ? null
      : {
          value: space.enclosed ? "Enclosed" : "Open",
          source: "floor_plan" as const,
          sourceLabel: SOURCE_LABELS.floorPlan,
          confirmed: false,
        };

  return {
    noise,
    brightness,
    daylight: features.natural_light,
    lightingLabel: lightingLabel(brightness, features.natural_light, space.source),
    seating,
    setting,
    outlets: features.outlets,
    features,
  };
}
