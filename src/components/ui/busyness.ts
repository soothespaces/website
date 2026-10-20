/** Shapiro Library, Tuesday. Hours 0–23 from scripts/seed/manual-popular-times.json weekday 2. */
export const SHAPIRO_TUESDAY_BUSYNESS = [
  35, 24, 16, 15, 13, 13, 13, 19, 27, 42, 54, 66, 73, 82, 92, 95, 100, 95, 88, 79, 73, 70, 68, 61,
] as const;

// The Hours board labels noon and the ends of the day, not every three hours.
const AXIS: Record<number, string> = {
  0: "12 AM",
  6: "6 AM",
  12: "12 PM",
  18: "6 PM",
  23: "11 PM",
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
  let peak = -1;
  for (let hour = 0; hour < values.length; hour++) {
    const value = values[hour];
    if (!(value > 0)) continue;
    if (peak < 0 || value > values[peak]) peak = hour;
  }
  if (peak < 0) return "No typical busyness";
  return `Busiest around ${formatHour(peak)}`;
}

export function busynessChartLabel(values: readonly number[], highlightHour?: number) {
  const summary = busiestSummary(values);
  if (highlightHour == null || !Number.isInteger(highlightHour) || highlightHour < 0 || highlightHour >= values.length) {
    return summary;
  }
  return `${summary}. Highlighted hour: ${formatHour(highlightHour)}.`;
}
