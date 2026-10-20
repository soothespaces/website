import { WEEKDAY_NAMES } from "@/lib/detroit";

/** A period behind one or more rows on the week list. */
export type HoursSourcePeriod = {
  label: string | null;
  validFrom: string;
  validUntil: string;
  source: string;
};

const SOURCE_CREDIT: Record<string, string> = {
  um_library: "the U-M Library",
  google: "Google Maps",
};

const SHORT_DAY: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

/** "Aug 30". The year stays off; a semester runs across New Year. */
export function formatPeriodDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function creditFor(source: string): string {
  return SOURCE_CREDIT[source] ?? source;
}

/**
 * "Fall and winter semester hours, Aug 30 – May 8. From the U-M Library."
 * Several periods share one "From" line when they share a source.
 */
export function hoursSourceNote(periods: readonly HoursSourcePeriod[]): string | null {
  if (!periods.length) return null;
  const lines = periods.map((period) => {
    const range = `${formatPeriodDate(period.validFrom)} – ${formatPeriodDate(period.validUntil)}`;
    return `${period.label ? `${period.label}, ${range}` : range}.`;
  });
  const sources = [...new Set(periods.map((period) => period.source))];
  if (sources.length === 1) return `${lines.join(" ")} From ${creditFor(sources[0]!)}.`;
  return periods.map((period, index) => `${lines[index]} From ${creditFor(period.source)}.`).join(" ");
}

/** The accent headline. "Open 24 hours" gains "today"; other statuses pass through. */
export function statusHeadline(status: string | null): string {
  if (!status) return "Hours not listed";
  if (status === "Open 24 hours") return "Open 24 hours today";
  return status;
}

/** "Closes Fri 6 PM" → "Next close: Friday 6 PM". */
export function nextCloseLine(close: string | null): string | null {
  if (!close) return null;
  const match = /^Closes ([A-Za-z]+) (.+)$/.exec(close);
  if (!match) return null;
  const day = SHORT_DAY[match[1]!] ?? match[1];
  return `Next close: ${day} ${match[2]}`;
}

/** "Tuesday · today" on the current row, otherwise the weekday name. */
export function weekDayLabel(day: string, today: boolean): string {
  return today ? `${day} · today` : day;
}

/** Day picker labels: "Tuesdays" for the weekday Google's curve describes. */
export const BUSY_DAY_OPTIONS = WEEKDAY_NAMES.map((name, weekday) => ({
  value: String(weekday),
  label: `${name}s`,
}));
