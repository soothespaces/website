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

function periodRange(period: HoursSourcePeriod): string | null {
  // Google's valid_from/valid_until is the cache window, not a real term.
  if (period.source === "google") return null;
  const start = formatPeriodDate(period.validFrom);
  if (period.validFrom === period.validUntil) return start;
  return `${start} – ${formatPeriodDate(period.validUntil)}`;
}

function periodLine(period: HoursSourcePeriod): string {
  const range = periodRange(period);
  if (period.label && range) return `${period.label}, ${range}.`;
  if (period.label) return `${period.label}.`;
  if (range) return `${range}.`;
  return "";
}

/**
 * "Fall and winter semester hours, Aug 30 – May 8. From the U-M Library."
 * Periods are named in date order. A one-day range is a single date.
 * Several periods share one "From" line when they share a source.
 */
export function hoursSourceNote(periods: readonly HoursSourcePeriod[]): string | null {
  if (!periods.length) return null;
  const ordered = [...periods].sort(
    (a, b) =>
      a.validFrom.localeCompare(b.validFrom) ||
      a.validUntil.localeCompare(b.validUntil) ||
      (a.label ?? "").localeCompare(b.label ?? ""),
  );
  const lines = ordered.map(periodLine).filter((line) => line.length > 0);
  if (!lines.length) return null;
  const sources = [...new Set(ordered.map((period) => period.source).filter((source) => source.length > 0))];
  if (sources.length === 0) return lines.join(" ");
  if (sources.length === 1) return `${lines.join(" ")} From ${creditFor(sources[0]!)}.`;
  return ordered
    .map((period) => {
      const line = periodLine(period);
      if (!line) return "";
      return period.source ? `${line} From ${creditFor(period.source)}.` : line;
    })
    .filter((line) => line.length > 0)
    .join(" ");
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
