"use client";

import { useEffect, useState } from "react";
import { addDays, daysBetween, detroitParts, formatClock, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOfDate } from "@/lib/detroit";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { readAll } from "./read-all";

export type HourAccess = "public" | "mcard";

/** One open interval. `closes` is minutes from the same midnight and may pass 1440 when it ends the next day. */
export type HourInterval = {
  opens: number;
  closes: number;
  access: HourAccess;
};

export type DatedHours = {
  date: string;
  weekday: number;
  intervals: HourInterval[];
};

export type OpeningHours = {
  /** The Detroit date these rows were anchored on, YYYY-MM-DD. */
  date: string;
  /** Weekday of `date` (0 = Sunday). */
  weekday: number;
  /** Yesterday through eight days ahead. Each date uses the period that covers it. */
  byDate: DatedHours[];
  /** Periods behind the Sunday–Saturday list, in that order, without duplicates. */
  periods: HoursPeriod[];
};

export type OpeningHourRow = {
  buildingSlug: string | null;
  spaceId: string | null;
  validFrom: string;
  validUntil: string;
  weekday: number;
  opens: string | null;
  closes: string | null;
  access: string;
  /** Period name, e.g. "Fall and winter semester hours". Optional so callers that only need intervals can omit it. */
  label?: string | null;
  /** `um_library`, `google`, or another loader id. Optional for the same reason. */
  source?: string;
};

/** One dated period that supplies at least one day on the Hours week list. */
export type HoursPeriod = {
  label: string | null;
  validFrom: string;
  validUntil: string;
  source: string;
};

export type WeekRow = {
  weekday: number;
  /** The calendar date this row describes, in the coming week. */
  date: string;
  day: (typeof WEEKDAY_NAMES)[number];
  /** "8 AM – 2 AM", "Open 24 hours", or "Closed". */
  hours: string;
  today: boolean;
};

const HOUR_SELECT =
  "building_slug, space_id, valid_from, valid_until, weekday, opens, closes, access, label, source";

type HourRecord = {
  building_slug: string | null;
  space_id: string | null;
  valid_from: string;
  valid_until: string;
  weekday: number;
  opens: string | null;
  closes: string | null;
  access: string;
  label: string | null;
  source: string;
};

/** "08:00:00" → 480. "24:00:00" → 1440. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return null;
  if (hour === 24 && minute === 0) return 1440;
  if (hour > 23) return null;
  return hour * 60 + minute;
}

function toInterval(row: OpeningHourRow): HourInterval | null {
  if (row.opens == null || row.closes == null) return null;
  const opens = parseClock(row.opens);
  const closes = parseClock(row.closes);
  if (opens == null || closes == null || opens === closes) return null;
  // closes at or before opens ends the next day: 08:00–02:00 is 8 AM to 2 AM,
  // and 10:00–00:00 is 10 AM to midnight. 00:00–24:00 stays a full day.
  const end = closes <= opens ? closes + 1440 : closes;
  const access: HourAccess = row.access === "mcard" ? "mcard" : "public";
  return { opens, closes: end, access };
}

/** Rows that win for one calendar date. A space's rows replace the building's. The narrowest covering period wins; a tie goes to the later valid_from. */
function winningRows(rows: readonly OpeningHourRow[], date: string): OpeningHourRow[] {
  const weekday = weekdayOfDate(date);
  const covering = rows.filter((row) => row.weekday === weekday && row.validFrom <= date && date <= row.validUntil);
  const space = covering.filter((row) => row.spaceId);
  const building = covering.filter((row) => !row.spaceId);
  const pool = space.length ? space : building;
  if (!pool.length) return [];

  const minSpan = Math.min(...pool.map((row) => daysBetween(row.validFrom, row.validUntil)));
  const narrow = pool.filter((row) => daysBetween(row.validFrom, row.validUntil) === minSpan);
  const latest = narrow.map((row) => row.validFrom).sort().at(-1)!;
  return narrow.filter((row) => row.validFrom === latest);
}

/** Intervals for one calendar date, from {@link winningRows}. */
export function intervalsOn(rows: readonly OpeningHourRow[], date: string): HourInterval[] {
  return winningRows(rows, date)
    .map(toInterval)
    .filter((interval): interval is HourInterval => interval != null)
    .sort((a, b) => a.opens - b.opens);
}

function periodKey(row: OpeningHourRow): string {
  return `${row.label ?? ""}\0${row.validFrom}\0${row.validUntil}\0${row.source ?? ""}`;
}

/** Distinct periods for Sunday through Saturday of the coming week, list order. */
export function periodsForWeek(rows: readonly OpeningHourRow[], date: string): HoursPeriod[] {
  const weekday = weekdayOfDate(date);
  const seen = new Set<string>();
  const periods: HoursPeriod[] = [];
  for (let day = 0; day < 7; day++) {
    const dayDate = addDays(date, (day - weekday + 7) % 7);
    for (const row of winningRows(rows, dayDate)) {
      const key = periodKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      periods.push({
        label: row.label ?? null,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        source: row.source ?? "",
      });
    }
  }
  return periods;
}

/**
 * Yesterday through eight days ahead, each resolved against its own date.
 * A holiday that starts on Wednesday does not inherit Tuesday's period.
 */
export function resolveOpeningHours(rows: readonly OpeningHourRow[], date: string): OpeningHours | null {
  const byDate: DatedHours[] = [];
  for (let offset = -1; offset <= 8; offset++) {
    const day = addDays(date, offset);
    byDate.push({ date: day, weekday: weekdayOfDate(day), intervals: intervalsOn(rows, day) });
  }
  const anyRow = byDate.some((day) => rows.some((row) => row.validFrom <= day.date && day.date <= row.validUntil));
  if (!anyRow) return null;
  return { date, weekday: weekdayOfDate(date), byDate, periods: periodsForWeek(rows, date) };
}

type Span = { start: number; end: number };

/** Spans in minutes from the first stored date's midnight. An overnight close extends into the next date. */
function absoluteSpans(hours: OpeningHours): Span[] {
  const spans: Span[] = [];
  hours.byDate.forEach((day, index) => {
    const base = index * 1440;
    for (const interval of day.intervals) spans.push({ start: base + interval.opens, end: base + interval.closes });
  });
  return spans.sort((a, b) => a.start - b.start);
}

function isOpenAllDay(intervals: readonly HourInterval[]): boolean {
  return intervals.length === 1 && intervals[0]!.opens === 0 && intervals[0]!.closes === 1440;
}

function placeNow(hours: OpeningHours, now: Date): { minutes: number; absolute: number; spans: Span[]; today: DatedHours; horizon: number } | null {
  const parts = detroitParts(now);
  const today = hours.byDate.find((day) => day.date === parts.date);
  if (!today) return null;
  const index = hours.byDate.indexOf(today);
  return {
    minutes: parts.minutes,
    absolute: index * 1440 + parts.minutes,
    spans: absoluteSpans(hours),
    today,
    horizon: hours.byDate.length * 1440,
  };
}

function openSpan(placed: NonNullable<ReturnType<typeof placeNow>>): Span | null {
  return placed.spans.find((span) => placed.absolute >= span.start && placed.absolute < span.end) ?? null;
}

/** Walk forward across intervals that touch, so 10 PM–midnight plus the next day's open is one stretch. */
function continuousEnd(placed: NonNullable<ReturnType<typeof placeNow>>, current: Span): number | null {
  let end = current.end;
  for (;;) {
    const touch = placed.spans.find((span) => span.start <= end && span.end > end);
    if (!touch) break;
    end = touch.end;
    if (end >= placed.horizon) return null;
  }
  return end;
}

function describeClose(end: number, originDate: string): { weekday: number; minute: number } {
  // A close exactly at midnight belongs to the day that is ending, not the next morning.
  if (end % 1440 === 0) {
    const date = addDays(originDate, end / 1440 - 1);
    return { weekday: weekdayOfDate(date), minute: 1440 };
  }
  const date = addDays(originDate, Math.floor(end / 1440));
  return { weekday: weekdayOfDate(date), minute: end % 1440 };
}

function closeClock(minute: number): string {
  return minute === 1440 ? "midnight" : formatClock(minute);
}

export function isOpenNow(hours: OpeningHours | null, now: Date): boolean {
  if (!hours) return false;
  const placed = placeNow(hours, now);
  if (!placed) return false;
  return openSpan(placed) != null;
}

export function openStatus(hours: OpeningHours | null, now: Date): string | null {
  if (!hours) return null;
  const placed = placeNow(hours, now);
  if (!placed) return null;
  const current = openSpan(placed);
  if (current) {
    if (isOpenAllDay(placed.today.intervals)) return "Open 24 hours";
    const end = continuousEnd(placed, current);
    if (end == null) return "Open 24 hours";
    const todayIndex = hours.byDate.indexOf(placed.today);
    const endOfToday = (todayIndex + 1) * 1440;
    // A close overnight, through 6 AM, is still "Open until 2 AM" rather than the next day's name.
    if (end <= endOfToday + 6 * 60) {
      if (end === endOfToday) return "Open until midnight";
      return `Open until ${formatClock(end)}`;
    }
    const close = describeClose(end, hours.byDate[0]!.date);
    return `Open until ${WEEKDAY_SHORT[close.weekday]} ${closeClock(close.minute)}`;
  }
  const later = placed.today.intervals.find((interval) => interval.opens > placed.minutes);
  if (later) return `Opens at ${formatClock(later.opens)}`;
  return "Closed today";
}

/**
 * When the building is open, the end of this continuous open stretch.
 * "Closes Fri 6 PM" for a 24-hour building that finally closes Friday.
 * A close at midnight is "Closes Fri midnight", not "Closes Sat 12 AM".
 * Null when it is closed now, or open every day we can see.
 */
export function nextClose(hours: OpeningHours | null, now: Date): string | null {
  if (!hours) return null;
  const placed = placeNow(hours, now);
  if (!placed) return null;
  const current = openSpan(placed);
  if (!current) return null;
  const end = continuousEnd(placed, current);
  if (end == null) return null;
  const close = describeClose(end, hours.byDate[0]!.date);
  return `Closes ${WEEKDAY_SHORT[close.weekday]} ${closeClock(close.minute)}`;
}

function hoursLabel(intervals: readonly HourInterval[]): string {
  if (isOpenAllDay(intervals)) return "Open 24 hours";
  if (!intervals.length) return "Closed";
  return intervals.map((interval) => `${formatClock(interval.opens)} – ${formatClock(interval.closes)}`).join(", ");
}

/** Sunday through Saturday, each row the date of that weekday in the coming week (today through six days ahead). */
export function weekRows(hours: OpeningHours | null): WeekRow[] {
  if (!hours) return [];
  return WEEKDAY_NAMES.map((day, weekday) => {
    const delta = (weekday - hours.weekday + 7) % 7;
    const date = addDays(hours.date, delta);
    const intervals = hours.byDate.find((entry) => entry.date === date)?.intervals ?? [];
    return { weekday, date, day, hours: hoursLabel(intervals), today: delta === 0 };
  });
}

export type OpeningHoursState = {
  hours: OpeningHours | null;
  loaded: boolean;
  error: string | null;
};

function toRow(record: HourRecord): OpeningHourRow {
  return {
    buildingSlug: record.building_slug,
    spaceId: record.space_id,
    validFrom: record.valid_from,
    validUntil: record.valid_until,
    weekday: record.weekday,
    opens: record.opens,
    closes: record.closes,
    access: record.access,
    label: record.label,
    source: record.source,
  };
}

/**
 * Hours for a building, or for a space (its own rows override the building's
 * for any weekday the space lists).
 */
export function useOpeningHours(target: { buildingSlug?: string | null; spaceId?: string | null } | null): OpeningHoursState {
  const buildingSlug = target?.buildingSlug ?? null;
  const spaceId = target?.spaceId ?? null;
  const requestKey = `${buildingSlug ?? ""}\n${spaceId ?? ""}`;
  const [state, setState] = useState<OpeningHoursState & { key: string }>(() => ({
    key: "",
    hours: null,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (!getSupabaseEnv() || (!buildingSlug && !spaceId)) return;
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      try {
        let slug = buildingSlug;
        if (spaceId && !slug) {
          const { data, error } = await supabase.from("spaces").select("building_slug").eq("id", spaceId).maybeSingle();
          if (error) throw error;
          slug = data?.building_slug ?? null;
        }
        const [buildingRows, spaceRows] = await Promise.all([
          slug
            ? readAll<HourRecord>((from, to) =>
                supabase
                  .from("opening_hours")
                  .select(HOUR_SELECT)
                  .eq("building_slug", slug!)
                  .is("space_id", null)
                  .order("id")
                  .range(from, to),
              )
            : Promise.resolve([]),
          spaceId
            ? readAll<HourRecord>((from, to) =>
                supabase.from("opening_hours").select(HOUR_SELECT).eq("space_id", spaceId).order("id").range(from, to),
              )
            : Promise.resolve([]),
        ]);
        const hours = resolveOpeningHours([...buildingRows, ...spaceRows].map(toRow), detroitParts(new Date()).date);
        if (!cancelled) setState({ key: requestKey, hours, loaded: true, error: null });
      } catch (error) {
        console.error("Opening hours failed to load", error);
        if (!cancelled) setState({ key: requestKey, hours: null, loaded: true, error: "Opening hours failed to load." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buildingSlug, spaceId, requestKey]);

  if (!getSupabaseEnv()) return { hours: null, loaded: true, error: "Supabase isn't configured." };
  if (!buildingSlug && !spaceId) return { hours: null, loaded: true, error: null };
  if (state.key !== requestKey) return { hours: null, loaded: false, error: null };
  return { hours: state.hours, loaded: state.loaded, error: state.error };
}
