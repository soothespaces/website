import { FEATURE_LABELS, NOISE_LABELS } from "./labels";
import type { SpaceSummary } from "./types";

// Lowercase without accents, so "cafe" finds "Café".
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function haystack(space: SpaceSummary) {
  return fold(
    [
      space.name,
      space.building?.name,
      space.floor_label,
      space.summary,
      space.noise_level ? NOISE_LABELS[space.noise_level] : null,
      ...space.features.map((feature) => FEATURE_LABELS[feature]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// Spaces matching every word of the query, in any of their name, building,
// floor, summary, noise level or features. Names that start with the query
// come first; otherwise the input order is kept.
export function searchSpaces(spaces: SpaceSummary[], query: string): SpaceSummary[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return spaces;
  const q = words.join(" ");
  const matches = spaces.filter((space) => {
    const text = haystack(space);
    return words.every((word) => text.includes(word));
  });
  const starts = (space: SpaceSummary) =>
    fold(space.name).startsWith(q) || fold(space.building?.name ?? "").startsWith(q) ? 0 : 1;
  return matches.map((space, i) => ({ space, i, rank: starts(space) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ space }) => space);
}
