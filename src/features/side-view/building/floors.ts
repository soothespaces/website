// "8" and "2 to 6": `buildings.floors` is the count whenever we have it.
// Plans, space labels and bookable rooms only draw the range. Basement is 0.
// A building with a count and nothing else still gets the number, and no range.

export function floorsInLabel(label: string | null | undefined): number[] {
  if (!label) return [];
  const numbers = [...label.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (/basement/i.test(label)) return [0, ...numbers];
  return numbers;
}

export function floorCode(floor: number): string {
  if (floor === 0) return "B";
  if (floor < 0) return `B${-floor}`;
  return String(floor);
}

export function floorTile(floors: readonly number[]): { value: string; detail: string } | null {
  const unique = [...new Set(floors.filter((floor) => Number.isInteger(floor)))].sort((a, b) => a - b);
  if (unique.length === 0) return null;
  const low = floorCode(unique[0]);
  const high = floorCode(unique[unique.length - 1]);
  return { value: String(unique.length), detail: low === high ? low : `${low} to ${high}` };
}

export function collectFloors(input: {
  planFloors: readonly number[];
  labels: readonly (string | null | undefined)[];
  extraFloors?: readonly number[];
  /** `buildings.floors`. Wins over the number of floors we happened to find. */
  recordedCount?: number | null;
}): { value: string; detail?: string } | null {
  const seen = floorTile([
    ...input.planFloors,
    ...input.labels.flatMap((label) => floorsInLabel(label)),
    ...(input.extraFloors ?? []),
  ]);
  const recorded = input.recordedCount != null && input.recordedCount > 0 ? String(input.recordedCount) : null;
  if (!seen && !recorded) return null;
  return {
    value: recorded ?? seen!.value,
    ...(seen ? { detail: seen.detail } : {}),
  };
}
