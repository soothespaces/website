/** Shapiro Library, Tuesday. Hours 0–23 from scripts/seed/manual-popular-times.json weekday 2. */
export const SHAPIRO_TUESDAY_BUSYNESS = [
  35, 24, 16, 15, 13, 13, 13, 19, 27, 42, 54, 66, 73, 82, 92, 95, 100, 95, 88, 79, 73, 70, 68, 61,
] as const;

const AXIS: Record<number, string> = {
  0: "12a",
  3: "3a",
  6: "6a",
  9: "9a",
  12: "12p",
  15: "3p",
  18: "6p",
  21: "9p",
};

export function busynessAxisLabel(hour: number) {
  return AXIS[hour] ?? null;
}

export function formatHour(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const n = h % 12 || 12;
  return `${n} ${suffix}`;
}

export function busiestSummary(values: readonly number[]) {
  if (values.length === 0 || values.every((value) => !(value > 0))) return "No typical busyness";
  let peak = 0;
  for (let hour = 1; hour < values.length; hour++) {
    if (values[hour] > values[peak]) peak = hour;
  }
  return `Busiest around ${formatHour(peak)}`;
}
