"use client";

import { useEffect, useState } from "react";
import { daysBetween, detroitParts, formatClock, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOfDate } from "@/lib/detroit";
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

export type DayHours = {
  weekday: number;
  intervals: HourInterval[];
};

export type OpeningHours = {
  /** The Detroit date these rows were chosen for, YYYY-MM-DD. */
  date: string;
  /** Weekday of `date` (0 = Sunday). */
  weekday: number;
  days: DayHours[];
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
};

export type WeekRow = {
  weekday: number;
  day: (typeof WEEKDAY_NAMES)[number];
  /** "8 AM – 2 AM", "Open 24 hours", or "Closed". */
  hours: string;
  today: boolean;
};

const HOUR_SELECT = "building_slug, space_id, valid_from, valid_until, weekday, opens, closes, access";

type HourRecord = {
  building_slug: string | null;
  space_id: string | null;
  valid_from: string;
  valid_until: string;
  weekday: number;
  opens: string | null;
  closes: string | null;
  access: string;
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

/**
 * Rows valid on `date`. For each weekday, the narrowest period that lists it
 * wins; a tie goes to the later valid_from. A space's rows replace the
 * building's for that weekday.
 */
export function resolveOpeningHours(rows: readonly OpeningHourRow[], date: string): OpeningHours | null {
  const covering = rows.filter((row) => row.validFrom <= date && date <= row.validUntil);
  if (!covering.length) return null;

  const days: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const space = covering.filter((row) => row.spaceId && row.weekday === weekday);
    const building = covering.filter((row) => !row.spaceId && row.weekday === weekday);
    const pool = space.length ? space : building;
    if (!pool.length) return { weekday, intervals: [] };

    const minSpan = Math.min(...pool.map((row) => daysBetween(row.validFrom, row.validUntil)));
    const narrow = pool.filter((row) => daysBetween(row.validFrom, row.validUntil) === minSpan);
    const latest = narrow.map((row) => row.validFrom).sort().at(-1)!;
    const chosen = narrow.filter((row) => row.validFrom === latest);
    const intervals = chosen
      .map(toInterval)
      .filter((interval): interval is HourInterval => interval != null)
      .sort((a, b) => a.opens - b.opens);
    return { weekday, intervals };
  });

  return { date, weekday: weekdayOfDate(date), days };
}

function dayIntervals(hours: OpeningHours, weekday: number): HourInterval[] {
  return hours.days[weekday]?.intervals ?? [];
}

type Span = { start: number; end: number };

/** Spans in absolute minutes from `originWeekday` at midnight, across `count` days. */
function absoluteSpans(hours: OpeningHours, originWeekday: number, count: number): Span[] {
  const spans: Span[] = [];
  for (let offset = 0; offset < count; offset++) {
    const weekday = (originWeekday + offset) % 7;
    const base = offset * 1440;
    for (const interval of dayIntervals(hours, weekday)) {
      spans.push({ start: base + interval.opens, end: base + interval.closes });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function isOpenAllDay(hours: OpeningHours, weekday: number): boolean {
  const intervals = dayIntervals(hours, weekday);
  return intervals.length === 1 && intervals[0]!.opens === 0 && intervals[0]!.closes === 1440;
}

function placeNow(hours: OpeningHours, now: Date): { weekday: number; minutes: number; absolute: number; spans: Span[] } {
  const parts = detroitParts(now);
  // Start yesterday so an interval that began last evening still covers this morning.
  const origin = (parts.weekday + 6) % 7;
  const spans = absoluteSpans(hours, origin, 10);
  return { weekday: parts.weekday, minutes: parts.minutes, absolute: 1440 + parts.minutes, spans };
}

function openSpan(placed: ReturnType<typeof placeNow>): Span | null {
  return placed.spans.find((span) => placed.absolute >= span.start && placed.absolute < span.end) ?? null;
}

export function isOpenNow(hours: OpeningHours | null, now: Date): boolean {
  if (!hours) return false;
  return openSpan(placeNow(hours, now)) != null;
}

export function openStatus(hours: OpeningHours | null, now: Date): string | null {
  if (!hours) return null;
  const placed = placeNow(hours, now);
  const current = openSpan(placed);
  if (current) {
    if (isOpenAllDay(hours, placed.weekday) && placed.absolute >= 1440 && placed.absolute < 2880) return "Open 24 hours";
    return `Open until ${formatClock(current.end)}`;
  }
  const later = dayIntervals(hours, placed.weekday).find((interval) => interval.opens > placed.minutes);
  if (later) return `Opens at ${formatClock(later.opens)}`;
  return "Closed today";
}

/**
 * When the building is open, the end of this continuous open stretch.
 * "Closes Fri 6 PM" for a 24-hour building that finally closes Friday.
 * Null when it is closed now, or open every day we can see.
 */
export function nextClose(hours: OpeningHours | null, now: Date): string | null {
  if (!hours) return null;
  const placed = placeNow(hours, now);
  const current = openSpan(placed);
  if (!current) return null;
  const horizon = 9 * 1440;
  let end = current.end;
  for (;;) {
    const touch = placed.spans.find((span) => span.start <= end && span.end > end);
    if (!touch) break;
    end = touch.end;
    if (end >= horizon) return null;
  }
  const origin = (placed.weekday + 6) % 7;
  const dayIndex = Math.floor((end - 1) / 1440);
  const closeWeekday = (origin + dayIndex) % 7;
  return `Closes ${WEEKDAY_SHORT[closeWeekday]} ${formatClock(end)}`;
}

export function weekRows(hours: OpeningHours | null): WeekRow[] {
  if (!hours) return [];
  return WEEKDAY_NAMES.map((day, weekday) => {
    const intervals = dayIntervals(hours, weekday);
    let label = "Closed";
    if (isOpenAllDay(hours, weekday)) label = "Open 24 hours";
    else if (intervals.length) {
      label = intervals.map((interval) => `${formatClock(interval.opens)} – ${formatClock(interval.closes)}`).join(", ");
    }
    return { weekday, day, hours: label, today: weekday === hours.weekday };
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
