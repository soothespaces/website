import type { GroupSize } from "@/lib/ranking";

export type { GroupSize };

// Home's "How many people?" chips, stored as the ranking GroupSize.
// null means not chosen. The query strings stay the chip labels:
// just-me, 2-3, and 4+ (percent-encoded as people=4%2B).
export const PEOPLE_PARAM = "people";

const PEOPLE_BY_GROUP_SIZE: Record<GroupSize, string> = {
  just_me: "just-me",
  "2_3": "2-3",
  "4_plus": "4+",
};

// `4+` is percent-encoded in the query. A hand-copied `?people=4+` is
// decoded as "4 " because "+" means space.
const GROUP_SIZE_BY_PEOPLE: Record<string, GroupSize> = {
  "just-me": "just_me",
  "2-3": "2_3",
  "4+": "4_plus",
  "4 ": "4_plus",
};

export function serializeGroupSize(groupSize: GroupSize | null): string | null {
  if (groupSize == null) return null;
  return PEOPLE_BY_GROUP_SIZE[groupSize];
}

export function parseGroupSize(value: string | null): GroupSize | null {
  if (value == null || value === "") return null;
  return GROUP_SIZE_BY_PEOPLE[value] ?? null;
}

// Search string with `people` set or removed. Other params stay put.
export function searchWithGroupSize(search: string, groupSize: GroupSize | null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = serializeGroupSize(groupSize);
  if (value == null) params.delete(PEOPLE_PARAM);
  else params.set(PEOPLE_PARAM, value);
  return params.toString();
}

export function hrefWithGroupSize(
  location: { pathname: string; search: string; hash: string },
  groupSize: GroupSize | null,
): string {
  const search = searchWithGroupSize(location.search, groupSize);
  return `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
}

// Next's replaceState keeps only its own keys when the data argument is null,
// which drops app keys such as the panel stack. Hand those keys back and omit
// Next's, so its patch copies them on again and still refreshes useSearchParams.
// The first time the map is seen, `retained` is undefined and the query wins.
// After that the visit's choice wins, and the caller rewrites the URL when
// an older entry still has a different `?people=`.
export function resolveVisitGroupSize(
  retained: GroupSize | null | undefined,
  fromUrl: GroupSize | null,
): { groupSize: GroupSize | null; rewrite: boolean } {
  if (retained === undefined) return { groupSize: fromUrl, rewrite: false };
  return { groupSize: retained, rewrite: fromUrl !== retained };
}

export function historyStateWithoutNextKeys(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (key === "__NA" || key === "__PRIVATE_NEXTJS_INTERNALS_TREE") continue;
    rest[key] = value;
  }
  return rest;
}
