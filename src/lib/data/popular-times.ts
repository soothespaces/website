"use client";

import { useEffect, useState } from "react";
import { detroitParts, formatClock } from "@/lib/detroit";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { readAll } from "./read-all";

/**
 * Google's typical curve is 0–100. The four words split it into quarters:
 * 0–25 Not busy, 26–50 A little busy, 51–75 Fairly busy, 76–100 Very busy.
 */
export const BUSYNESS_WORDS = ["Not busy", "A little busy", "Fairly busy", "Very busy"] as const;
export type BusynessWord = (typeof BUSYNESS_WORDS)[number];

/**
 * A live reading within this many points of the typical value is still
 * "usual". There is no live feed today, so callers omit it.
 */
export const USUAL_BAND = 15;

/** `busyness[weekday][hour]`, weekday 0 = Sunday. Null where Google has no row. */
export type PopularTimes = {
  busyness: (number | null)[][];
};

export type PopularTimeRow = {
  weekday: number;
  hour: number;
  busyness: number;
};

export function emptyWeek(): (number | null)[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => null));
}

/** Null when the building has no rows, so the tile and the chart hide. */
export function popularTimesFromRows(rows: readonly PopularTimeRow[]): PopularTimes | null {
  if (!rows.length) return null;
  const busyness = emptyWeek();
  for (const row of rows) {
    if (row.weekday < 0 || row.weekday > 6 || row.hour < 0 || row.hour > 23) continue;
    if (!Number.isFinite(row.busyness)) continue;
    busyness[row.weekday]![row.hour] = row.busyness;
  }
  const any = busyness.some((day) => day.some((value) => value != null));
  return any ? { busyness } : null;
}

export function busynessWord(value: number): BusynessWord | null {
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  if (value <= 25) return "Not busy";
  if (value <= 50) return "A little busy";
  if (value <= 75) return "Fairly busy";
  return "Very busy";
}

/**
 * The line under the busyness word. "Usual for 8 PM" when we're showing the
 * typical curve (or a live reading close to it). "Busier than usual" or
 * "Quieter than usual" when `live` is more than {@link USUAL_BAND} points off.
 */
export function usualFor(times: PopularTimes | null, now: Date, live?: number | null): string | null {
  if (!times) return null;
  const parts = detroitParts(now);
  const typical = times.busyness[parts.weekday]?.[parts.hour];
  if (typical == null) return null;
  const hourLabel = formatClock(parts.hour * 60);
  if (live == null || !Number.isFinite(live) || Math.abs(live - typical) <= USUAL_BAND) return `Usual for ${hourLabel}`;
  return live > typical ? "Busier than usual" : "Quieter than usual";
}

export type PopularTimesState = {
  times: PopularTimes | null;
  loaded: boolean;
  error: string | null;
};

type PopularRecord = { weekday: number; hour: number; busyness: number };

export function usePopularTimes(buildingSlug: string | null): PopularTimesState {
  const [state, setState] = useState<PopularTimesState & { key: string }>(() => ({
    key: "",
    times: null,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (!getSupabaseEnv() || !buildingSlug) return;
    const supabase = createClient();
    let cancelled = false;

    readAll<PopularRecord>((from, to) =>
      supabase
        .from("building_popular_times")
        .select("weekday, hour, busyness")
        .eq("building_slug", buildingSlug)
        .order("weekday")
        .order("hour")
        .range(from, to),
    )
      .then((rows) => {
        if (!cancelled) setState({ key: buildingSlug, times: popularTimesFromRows(rows), loaded: true, error: null });
      })
      .catch((error: unknown) => {
        console.error("Popular times failed to load", error);
        if (!cancelled) setState({ key: buildingSlug, times: null, loaded: true, error: "Popular times failed to load." });
      });

    return () => {
      cancelled = true;
    };
  }, [buildingSlug]);

  if (!getSupabaseEnv()) return { times: null, loaded: true, error: "Supabase isn't configured." };
  if (!buildingSlug) return { times: null, loaded: true, error: null };
  if (state.key !== buildingSlug) return { times: null, loaded: false, error: null };
  return { times: state.times, loaded: state.loaded, error: state.error };
}
