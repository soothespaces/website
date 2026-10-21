import { rankSpaces, type CatalogSpace, type GroupSize, type RankContext } from "@/lib/ranking";
import { hasStudyPreferences, type StudyPreferences } from "@/lib/settings/model";

export { hasStudyPreferences };

export const UNLISTED_FLOOR = "Floor not listed yet";

export type FloorSource = {
  floor: number | null;
  floor_label: string | null;
};

export type FloorGroup<T> = {
  key: string;
  /** Numeric floor used for printers and bookable rooms. Null for the unlisted group. */
  number: number | null;
  title: string;
  unlisted: boolean;
  spaces: T[];
  note: string | null;
};

type FloorLabel = { number: number | null; title: string | null };

// A label that names one floor. "Floors 3 and 4" is not one floor, so it
// does not invent a group; the space's floor number still can.
export function describeFloorLabel(label: string | null | undefined): FloorLabel {
  if (!label) return { number: null, title: null };
  const text = label.trim().replace(/\s+/g, " ");
  if (!text) return { number: null, title: null };
  const lower = text.toLowerCase();
  if (lower === "basement" || lower === "0b" || lower === "b") return { number: -1, title: "Basement" };
  if (lower === "ground" || lower === "ground floor" || lower === "0g" || lower === "g") {
    return { number: 0, title: "Ground" };
  }
  const floorWord = lower.match(/^floor\s+(-?\d+)$/);
  if (floorWord) return titled(Number(floorWord[1]));
  const ordinal = lower.match(/^(-?\d+)(?:st|nd|rd|th)\s+floor$/);
  if (ordinal) return titled(Number(ordinal[1]));
  if (/^-?\d+$/.test(lower)) return titled(Number(lower));
  return { number: null, title: null };
}

function titled(number: number): FloorLabel {
  return { number, title: titleFromNumber(number) };
}

function titleFromNumber(number: number): string {
  if (number < 0) return "Basement";
  if (number === 0) return "Ground";
  return `Floor ${number}`;
}

export function floorIdentity(space: FloorSource): Pick<FloorGroup<never>, "key" | "number" | "title" | "unlisted"> {
  const label = describeFloorLabel(space.floor_label);
  if (space.floor == null && label.number == null) {
    return { key: "unlisted", number: null, title: UNLISTED_FLOOR, unlisted: true };
  }
  const number = space.floor ?? label.number!;
  // "Basement" stored as floor 0 keeps that number (printers use it) and the label's name.
  const title = label.title ?? titleFromNumber(number);
  return { key: `n:${number}`, number, title, unlisted: false };
}

/** Building order: Basement, then 1, 2, …, and spaces with no floor last. */
export function groupSpacesByFloor<T extends FloorSource>(spaces: readonly T[]): FloorGroup<T>[] {
  const groups = new Map<string, FloorGroup<T>>();
  for (const space of spaces) {
    const id = floorIdentity(space);
    const group = groups.get(id.key);
    if (!group) {
      groups.set(id.key, { ...id, spaces: [space], note: null });
      continue;
    }
    group.spaces.push(space);
    // Floor 0 is "Ground" until a space on it says Basement.
    if (id.title !== titleFromNumber(id.number ?? 0) && group.title === titleFromNumber(group.number ?? 0)) {
      group.title = id.title;
    }
  }
  const listed = [...groups.values()].filter((group) => !group.unlisted);
  listed.sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.title.localeCompare(b.title));
  const unlisted = groups.get("unlisted");
  return unlisted ? [...listed, unlisted] : listed;
}

/**
 * Orders rows inside each floor with rankSpaces. Floors stay in building
 * order, and ranking never drops a space.
 */
export function rankWithinFloors<T extends FloorSource & CatalogSpace>(
  groups: readonly FloorGroup<T>[],
  context: RankContext = {},
): FloorGroup<T>[] {
  return groups.map((group) => ({
    ...group,
    spaces: rankSpaces(group.spaces, context).map((ranked) => ranked.space),
  }));
}

export function spacesTitle(count: number): string {
  return count === 1 ? "1 study space" : `${count} study spaces`;
}

/**
 * Why the rows are ordered. Preferences and group size both feed rankSpaces.
 * Null when neither is set, so the line stays hidden.
 */
export function spacesSortCaption(study: StudyPreferences, groupSize: GroupSize | null): string | null {
  const preferences = hasStudyPreferences(study);
  if (!preferences && groupSize == null) return null;
  if (preferences && groupSize) return "Sorted by how you like to study and your group size";
  if (preferences) return "Sorted by how you like to study";
  return "Sorted for your group size";
}

const NOISE_RANK = { quiet: 0, low_noise: 1, conversational: 2, loud: 3 } as const;

type NoiseName = keyof typeof NOISE_RANK;

export type FloorOverview = {
  typicalNoise: string | null;
  checkInCount: number;
};

export type FloorNoteContext = {
  bookableByFloor: ReadonlyMap<number, number>;
  entrances: readonly { floor_label: string | null }[];
  overview: ReadonlyMap<string, FloorOverview>;
};

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function quietestKey<T extends { id: string }>(
  groups: readonly FloorGroup<T>[],
  overview: ReadonlyMap<string, FloorOverview>,
): string | null {
  const scores: { key: string; score: number }[] = [];
  for (const group of groups) {
    if (group.unlisted) continue;
    let weight = 0;
    let sum = 0;
    for (const space of group.spaces) {
      const row = overview.get(space.id);
      if (!row || row.checkInCount <= 0 || !row.typicalNoise) continue;
      const rank = NOISE_RANK[row.typicalNoise as NoiseName];
      if (rank == null) continue;
      weight += row.checkInCount;
      sum += rank * row.checkInCount;
    }
    if (weight > 0) scores.push({ key: group.key, score: sum / weight });
  }
  if (scores.length < 2) return null;
  scores.sort((a, b) => a.score - b.score);
  if (scores[0].score === scores[1].score) return null;
  return scores[0].key;
}

function mentionsCaen(space: { name: string; summary?: string | null }): boolean {
  return /\bcaen\b/i.test(`${space.name} ${space.summary ?? ""}`);
}

/**
 * One right-hand note per floor, and only when the data can support it.
 * Bookable rooms, then the quietest floor, then an entrance on that floor,
 * then a CAEN lab named in the spaces. The unlisted group counts its spaces.
 */
export function withFloorNotes<T extends { id: string; name: string; summary?: string | null }>(
  groups: readonly FloorGroup<T>[],
  context: FloorNoteContext,
): FloorGroup<T>[] {
  const quietest = quietestKey(groups, context.overview);
  const entranceTitles = new Set(
    context.entrances
      .map((entrance) => describeFloorLabel(entrance.floor_label).title)
      .filter((title): title is string => !!title),
  );
  return groups.map((group) => {
    if (group.unlisted) {
      return { ...group, note: countLabel(group.spaces.length, "space", "spaces") };
    }
    const bookable = group.number == null ? 0 : (context.bookableByFloor.get(group.number) ?? 0);
    if (bookable > 0) return { ...group, note: countLabel(bookable, "bookable room", "bookable rooms") };
    if (group.key === quietest) return { ...group, note: "Quietest floor" };
    if (entranceTitles.has(group.title)) return { ...group, note: "Entrance level" };
    if (group.spaces.some(mentionsCaen)) return { ...group, note: "CAEN lab" };
    return { ...group, note: null };
  });
}
