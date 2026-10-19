// Home's "How many people?" chips.
// solo is "Just me", small is "2–3", large is "4+".
// null means not chosen; ranking treats that as solo.
export type GroupSize = "solo" | "small" | "large";

export const PEOPLE_PARAM = "people";

const PEOPLE_BY_GROUP_SIZE = {
  solo: "just-me",
  small: "2-3",
  large: "4+",
} as const;

// `4+` is percent-encoded in the query (`people=4%2B`). A hand-copied
// `?people=4+` is decoded as "4 " because "+" means space.
const GROUP_SIZE_BY_PEOPLE: Record<string, GroupSize> = {
  "just-me": "solo",
  "2-3": "small",
  "4+": "large",
  "4 ": "large",
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
