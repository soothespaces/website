"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth/use-session";
import { onCheckedIn } from "@/features/check-in/checked-in";
import { addDays, detroitParts, monthName, weekdayOfDate } from "@/lib/detroit";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type HistoryTargetKind = "space" | "room";

/**
 * One place from `my_check_in_history()`. `visitedOn` is absent until BK5
 * adds per-visit dates; the monthly card hides weeks in a row without them.
 */
export type HistoryPlace = {
  targetKind: HistoryTargetKind;
  targetId: string;
  checkInCount: number;
  lastVisitedOn: string;
  visitedOn?: readonly string[] | null;
};

export type MonthlyStats = {
  /** "October" for the Detroit month of `now`. */
  month: string;
  checkIns: number;
  spots: number;
  /** Null until visit dates exist. 0 is a real streak of none. */
  weeksInARow: number | null;
};

function asCount(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 0) return null;
  return number;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseHistory(value: unknown): HistoryPlace[] {
  if (!Array.isArray(value)) return [];
  const places: HistoryPlace[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const targetKind = record.target_kind === "space" || record.target_kind === "room" ? record.target_kind : null;
    const checkInCount = asCount(record.check_in_count);
    if (!targetKind || typeof record.target_id !== "string" || checkInCount == null || !isDate(record.last_visited_on)) continue;
    const place: HistoryPlace = {
      targetKind,
      targetId: record.target_id,
      checkInCount,
      lastVisitedOn: record.last_visited_on,
    };
    const dates = record.visited_on ?? record.visitedOn;
    if (Array.isArray(dates)) place.visitedOn = dates.filter(isDate);
    places.push(place);
  }
  return places;
}

/** Sunday of the Detroit week containing `date`, as YYYY-MM-DD. */
export function weekStart(date: string): string {
  return addDays(date, -weekdayOfDate(date));
}

/**
 * Counts for the My spots card.
 *
 * Without per-visit dates (what the RPC returns today): `checkIns` and
 * `spots` are all-time, and `weeksInARow` is null so the card hides that stat.
 *
 * With dates: check-ins and spots are this Detroit month. Weeks in a row walk
 * backward through Sunday-start weeks. The current week may be empty — it
 * isn't over — and the streak then starts at the previous week.
 */
export function monthlyStats(history: readonly HistoryPlace[], now: Date): MonthlyStats {
  const today = detroitParts(now).date;
  const month = monthName(today);
  const dated = history.some((place) => place.visitedOn != null);
  if (!dated) {
    return {
      month,
      checkIns: history.reduce((sum, place) => sum + place.checkInCount, 0),
      spots: history.length,
      weeksInARow: null,
    };
  }

  const monthPrefix = today.slice(0, 7);
  const dates: string[] = [];
  let spots = 0;
  for (const place of history) {
    const inMonth = (place.visitedOn ?? []).filter((date) => date.startsWith(monthPrefix));
    if (inMonth.length) spots += 1;
    dates.push(...(place.visitedOn ?? []));
  }

  const weeks = new Set(dates.map(weekStart));
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let weeksInARow = 0;
  while (weeks.has(cursor)) {
    weeksInARow += 1;
    cursor = addDays(cursor, -7);
  }

  return { month, checkIns: dates.filter((date) => date.startsWith(monthPrefix)).length, spots, weeksInARow };
}

export type MyHistoryState = {
  places: HistoryPlace[];
  loaded: boolean;
  signedIn: boolean;
  error: string | null;
  refresh: () => void;
};

export function useMyCheckInHistory(): MyHistoryState {
  const { user, loading } = useSession();
  const userId = user?.id ?? null;
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((current) => current + 1), []);
  const [state, setState] = useState<Omit<MyHistoryState, "refresh" | "signedIn"> & { userId: string }>(() => ({
    userId: "",
    places: [],
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (loading || !userId || !getSupabaseEnv()) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("my_check_in_history");
        if (cancelled) return;
        if (error) throw error;
        setState({ userId, places: parseHistory(data), loaded: true, error: null });
      } catch (error) {
        console.error("Check-in history failed to load", error);
        if (!cancelled) setState({ userId, places: [], loaded: true, error: "Your check-ins failed to load." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, userId, nonce]);

  useEffect(() => onCheckedIn(() => refresh()), [refresh]);

  if (!getSupabaseEnv()) return { places: [], loaded: true, signedIn: false, error: "Supabase isn't configured.", refresh };
  if (loading || !userId) return { places: [], loaded: !loading, signedIn: false, error: null, refresh };
  if (state.userId !== userId) return { places: [], loaded: false, signedIn: true, error: null, refresh };
  return { places: state.places, loaded: state.loaded, signedIn: true, error: state.error, refresh };
}
