"use client";

import { useEffect, useState } from "react";
import { detroitParts } from "@/lib/detroit";
import { resolveOpeningHours, type OpeningHourRow, type OpeningHours } from "@/lib/data/opening-hours";
import { popularTimesFromRows, type PopularTimeRow, type PopularTimes } from "@/lib/data/popular-times";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type LiveTarget = {
  key: string;
  buildingSlug: string | null;
  spaceId: string | null;
};

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

type PopularRecord = PopularTimeRow & { building_slug: string };

const HOUR_SELECT = "building_slug, space_id, valid_from, valid_until, weekday, opens, closes, access";

function toHour(record: HourRecord): OpeningHourRow {
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

export type RotationLive = {
  loaded: boolean;
  hours: Map<string, OpeningHours | null>;
  times: Map<string, PopularTimes | null>;
};

const EMPTY_HOURS = new Map<string, OpeningHours | null>();
const EMPTY_TIMES = new Map<string, PopularTimes | null>();

/**
 * Hours and popular times for every favorite, in two reads. Same pure helpers
 * as useOpeningHours and usePopularTimes; a list would otherwise fetch once per row.
 */
export function useRotationLive(targets: readonly LiveTarget[], now: Date): RotationLive {
  const date = detroitParts(now).date;
  const targetKey = targets
    .map((target) => `${target.key}:${target.buildingSlug ?? ""}:${target.spaceId ?? ""}`)
    .sort()
    .join("|");
  const requestKey = `${date}\n${targetKey}`;
  const [state, setState] = useState<{ key: string; hours: Map<string, OpeningHours | null>; times: Map<string, PopularTimes | null> }>(
    () => ({ key: "", hours: EMPTY_HOURS, times: EMPTY_TIMES }),
  );

  useEffect(() => {
    const current = targets;
    if (!current.length || !getSupabaseEnv()) return;
    const supabase = createClient();
    let cancelled = false;
    const slugs = [...new Set(current.flatMap((target) => (target.buildingSlug ? [target.buildingSlug] : [])))];
    const spaceIds = [...new Set(current.flatMap((target) => (target.spaceId ? [target.spaceId] : [])))];

    (async () => {
      try {
        const [buildingHours, spaceHours, popular] = await Promise.all([
          slugs.length
            ? readAll<HourRecord>((from, to) =>
                supabase
                  .from("opening_hours")
                  .select(HOUR_SELECT)
                  .in("building_slug", slugs)
                  .is("space_id", null)
                  .order("id")
                  .range(from, to),
              )
            : Promise.resolve([]),
          spaceIds.length
            ? readAll<HourRecord>((from, to) =>
                supabase.from("opening_hours").select(HOUR_SELECT).in("space_id", spaceIds).order("id").range(from, to),
              )
            : Promise.resolve([]),
          slugs.length
            ? readAll<PopularRecord>((from, to) =>
                supabase
                  .from("building_popular_times")
                  .select("building_slug, weekday, hour, busyness")
                  .in("building_slug", slugs)
                  .order("building_slug")
                  .order("weekday")
                  .order("hour")
                  .range(from, to),
              )
            : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const buildingRows = new Map<string, OpeningHourRow[]>();
        for (const row of buildingHours.map(toHour)) {
          if (!row.buildingSlug) continue;
          const list = buildingRows.get(row.buildingSlug) ?? [];
          list.push(row);
          buildingRows.set(row.buildingSlug, list);
        }
        const spaceRows = new Map<string, OpeningHourRow[]>();
        for (const row of spaceHours.map(toHour)) {
          if (!row.spaceId) continue;
          const list = spaceRows.get(row.spaceId) ?? [];
          list.push(row);
          spaceRows.set(row.spaceId, list);
        }
        const hours = new Map<string, OpeningHours | null>();
        for (const target of current) {
          const rows = [
            ...(target.buildingSlug ? (buildingRows.get(target.buildingSlug) ?? []) : []),
            ...(target.spaceId ? (spaceRows.get(target.spaceId) ?? []) : []),
          ];
          hours.set(target.key, resolveOpeningHours(rows, date));
        }

        const grouped = new Map<string, PopularTimeRow[]>();
        for (const row of popular) {
          const list = grouped.get(row.building_slug) ?? [];
          list.push(row);
          grouped.set(row.building_slug, list);
        }
        const times = new Map<string, PopularTimes | null>();
        for (const slug of slugs) times.set(slug, popularTimesFromRows(grouped.get(slug) ?? []));
        setState({ key: requestKey, hours, times });
      } catch (error) {
        console.error("Rotation hours failed to load", error);
        if (!cancelled) setState({ key: requestKey, hours: EMPTY_HOURS, times: EMPTY_TIMES });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targets, date, requestKey]);

  if (!targets.length || !getSupabaseEnv()) return { loaded: true, hours: EMPTY_HOURS, times: EMPTY_TIMES };
  if (state.key !== requestKey) return { loaded: false, hours: EMPTY_HOURS, times: EMPTY_TIMES };
  return { loaded: true, hours: state.hours, times: state.times };
}
