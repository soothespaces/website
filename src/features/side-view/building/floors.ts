// "5" and "B to 4": every floor we can see on plans, space labels and room
// rows. Basement is 0. A building with only `buildings.floors` still gets a
// count, and no range, rather than a dash.

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
  recordedCount?: number | null;
}): { value: string; detail?: string } | null {
  const tile = floorTile([
    ...input.planFloors,
    ...input.labels.flatMap((label) => floorsInLabel(label)),
    ...(input.extraFloors ?? []),
  ]);
  if (tile) return tile;
  if (input.recordedCount != null && input.recordedCount > 0) return { value: String(input.recordedCount) };
  return null;
}
