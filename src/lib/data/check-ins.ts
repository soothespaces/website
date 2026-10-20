"use client";

import { useCallback, useEffect, useState } from "react";
import { onCheckedIn } from "@/features/check-in/checked-in";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

type Enums = Database["public"]["Enums"];
export type NoiseLevel = Enums["noise_level"];
export type LightLevel = Enums["light_level"];
export type BusynessLevel = Enums["busyness_level"];
export type SpaceFeature = Enums["space_feature"];
export type CheckInTargetKind = "space" | "room";

const NOISE: readonly NoiseLevel[] = ["quiet", "low_noise", "conversational", "loud"];
const LIGHT: readonly LightLevel[] = ["dim", "moderate", "bright"];
const BUSYNESS: readonly BusynessLevel[] = ["empty", "some_seats", "half_full", "mostly_full", "packed"];
const FEATURES: readonly SpaceFeature[] = [
  "natural_light",
  "wheelchair_accessible",
  "all_gender_restroom_on_floor",
  "whiteboards",
  "bookable",
  "external_monitors",
  "outlets",
  "computers",
  "printing",
  "scanners",
  "group_rooms",
];

/**
 * `check_in_summary()` returns jsonb. Counts are per answer, never per person.
 * A summary with `count` 0 is parsed, and the hook turns it into null.
 */
export type CheckInSummary = {
  count: number;
  lastAt: string | null;
  noise: Partial<Record<NoiseLevel, number>>;
  light: Partial<Record<LightLevel, number>>;
  busyness: Partial<Record<BusynessLevel, number>>;
  naturalLight: number;
  easeOfFocusMedian: number | null;
  features: Partial<Record<SpaceFeature, number>>;
};

export type CheckInOverviewRow = {
  targetId: string;
  checkInCount: number;
  typicalNoise: NoiseLevel | null;
  typicalLight: LightLevel | null;
  easeOfFocusMedian: number | null;
  lastAt: string | null;
};

function asCount(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function countMap<T extends string>(value: unknown, allowed: readonly T[]): Partial<Record<T, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedSet = new Set<string>(allowed);
  const counts: Partial<Record<T, number>> = {};
  for (const [key, count] of Object.entries(value)) {
    if (!allowedSet.has(key)) continue;
    const parsed = asCount(count);
    if (parsed == null) continue;
    counts[key as T] = parsed;
  }
  return counts;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Defensive parse of `check_in_summary`. Null when the payload isn't the documented object. */
export function parseCheckInSummary(value: unknown): CheckInSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const count = asCount(row.count);
  if (count == null) return null;
  const median = row.ease_of_focus_median == null ? null : asCount(row.ease_of_focus_median);
  return {
    count,
    lastAt: typeof row.last_at === "string" ? row.last_at : null,
    noise: countMap(row.noise, NOISE),
    light: countMap(row.light, LIGHT),
    busyness: countMap(row.busyness, BUSYNESS),
    naturalLight: asCount(row.natural_light) ?? 0,
    easeOfFocusMedian: median,
    features: countMap(row.features, FEATURES),
  };
}

/** No check-ins is null, so a screen can hide the block. */
export function presentSummary(summary: CheckInSummary | null): CheckInSummary | null {
  if (!summary || summary.count <= 0) return null;
  return summary;
}

export function parseOverviewRow(value: unknown): CheckInOverviewRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.target_id !== "string" || !row.target_id) return null;
  const checkInCount = asCount(row.check_in_count);
  if (checkInCount == null) return null;
  const median = row.ease_of_focus_median == null ? null : asCount(row.ease_of_focus_median);
  return {
    targetId: row.target_id,
    checkInCount,
    typicalNoise: asEnum(row.typical_noise, NOISE),
    typicalLight: asEnum(row.typical_light, LIGHT),
    easeOfFocusMedian: median,
    lastAt: typeof row.last_at === "string" ? row.last_at : null,
  };
}

export function overviewMap(rows: unknown): Map<string, CheckInOverviewRow> {
  const byId = new Map<string, CheckInOverviewRow>();
  if (!Array.isArray(rows)) return byId;
  for (const row of rows) {
    const parsed = parseOverviewRow(row);
    if (parsed && parsed.checkInCount > 0) byId.set(parsed.targetId, parsed);
  }
  return byId;
}

export type CheckInSummaryState = {
  summary: CheckInSummary | null;
  loaded: boolean;
  error: string | null;
  refresh: () => void;
};

export type CheckInOverviewState = {
  byId: Map<string, CheckInOverviewRow>;
  loaded: boolean;
  error: string | null;
  refresh: () => void;
};

const EMPTY_OVERVIEW = new Map<string, CheckInOverviewRow>();

function unconfigured(): boolean {
  return getSupabaseEnv() == null;
}

export function useCheckInSummary(
  targetKind: CheckInTargetKind,
  targetId: string | null,
  since?: string,
): CheckInSummaryState {
  const requestKey = `${targetKind}\n${targetId ?? ""}\n${since ?? ""}`;
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((current) => current + 1), []);
  const [state, setState] = useState<Omit<CheckInSummaryState, "refresh"> & { key: string }>(() => ({
    key: "",
    summary: null,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (unconfigured() || !targetId) return;
    const supabase = createClient();
    let cancelled = false;
    const args = since ? { target_kind: targetKind, target_id: targetId, since } : { target_kind: targetKind, target_id: targetId };

    (async () => {
      try {
        const { data, error } = await supabase.rpc("check_in_summary", args);
        if (cancelled) return;
        if (error) throw error;
        setState({ key: requestKey, summary: presentSummary(parseCheckInSummary(data)), loaded: true, error: null });
      } catch (error) {
        console.error("Check-in summary failed to load", error);
        if (!cancelled) setState({ key: requestKey, summary: null, loaded: true, error: "Check-ins failed to load." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetKind, targetId, since, nonce, requestKey]);

  useEffect(() => {
    return onCheckedIn((event) => {
      if (event.targetKind === targetKind && event.targetId === targetId) refresh();
    });
  }, [refresh, targetId, targetKind]);

  if (unconfigured()) return { summary: null, loaded: true, error: "Supabase isn't configured.", refresh };
  if (!targetId) return { summary: null, loaded: true, error: null, refresh };
  if (state.key !== requestKey) return { summary: null, loaded: false, error: null, refresh };
  return { summary: state.summary, loaded: state.loaded, error: state.error, refresh };
}

export function useCheckInOverview(targetKind: CheckInTargetKind, since?: string): CheckInOverviewState {
  const requestKey = `${targetKind}\n${since ?? ""}`;
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((current) => current + 1), []);
  const [state, setState] = useState<Omit<CheckInOverviewState, "refresh"> & { key: string }>(() => ({
    key: "",
    byId: EMPTY_OVERVIEW,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (unconfigured()) return;
    const supabase = createClient();
    let cancelled = false;
    const args = since ? { target_kind: targetKind, since } : { target_kind: targetKind };

    (async () => {
      try {
        const { data, error } = await supabase.rpc("check_in_overview", args);
        if (cancelled) return;
        if (error) throw error;
        setState({ key: requestKey, byId: overviewMap(data), loaded: true, error: null });
      } catch (error) {
        console.error("Check-in overview failed to load", error);
        if (!cancelled) setState({ key: requestKey, byId: EMPTY_OVERVIEW, loaded: true, error: "Check-ins failed to load." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetKind, since, nonce, requestKey]);

  useEffect(() => {
    return onCheckedIn((event) => {
      if (event.targetKind === targetKind) refresh();
    });
  }, [refresh, targetKind]);

  if (unconfigured()) return { byId: EMPTY_OVERVIEW, loaded: true, error: "Supabase isn't configured.", refresh };
  if (state.key !== requestKey) return { byId: EMPTY_OVERVIEW, loaded: false, error: null, refresh };
  return { byId: state.byId, loaded: state.loaded, error: state.error, refresh };
}
