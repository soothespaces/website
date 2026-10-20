import { busiestSummary } from "@/components/ui/busyness";
import { formatClock } from "@/lib/detroit";

/** 24 bar heights, or null when this weekday has no typical curve. */
export function chartValues(day: readonly (number | null)[] | undefined): number[] | null {
  if (!day?.some((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return day.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : 0));
}

/**
 * "Usually fairly busy at 8 PM." uses F1.2's word for the chosen day at the
 * current hour. "Busiest around 4 PM." is that day's peak. Either can be
 * absent: a missing hour, or a day that never rises above zero.
 */
export function busySummary(
  day: readonly (number | null)[] | undefined,
  hour: number,
  word: string | null,
): { usual: string | null; peak: string | null } {
  const values = chartValues(day);
  if (!values) return { usual: null, peak: null };
  const usual = word ? `Usually ${word.charAt(0).toLowerCase()}${word.slice(1)} at ${formatClock(hour * 60)}.` : null;
  const peakText = busiestSummary(values);
  const peak = peakText === "No typical busyness" ? null : `${peakText}.`;
  return { usual, peak };
}

/** The chart marks the current hour only on today's curve. */
export function highlightHour(chosenWeekday: number, todayWeekday: number, hour: number): number | undefined {
  if (chosenWeekday !== todayWeekday) return undefined;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return undefined;
  return hour;
}
