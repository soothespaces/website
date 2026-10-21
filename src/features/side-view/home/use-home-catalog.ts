"use client";

import { useEffect, useMemo, useState } from "react";
import { useMapState } from "@/features/map/map-state";
import type { OpeningHourRow } from "@/lib/data/opening-hours";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  describeSpace,
  hoursForSpace,
  indexHours,
  spaceIsBookable,
  type HomeSpace,
  type HourIndex,
} from "./places";

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

type BookableRecord = {
  space_id: string | null;
  building_slug: string | null;
};

type PlaceFacts = {
  loaded: boolean;
  hours: HourIndex;
  spaceIds: ReadonlySet<string>;
  buildingSlugs: ReadonlySet<string>;
};

const HOUR_SELECT = "building_slug, space_id, valid_from, valid_until, weekday, opens, closes, access";

const EMPTY_INDEX: HourIndex = { bySpace: new Map(), byBuilding: new Map() };
const EMPTY_IDS: ReadonlySet<string> = new Set();

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

function usePlaceFacts(): PlaceFacts {
  const [facts, setFacts] = useState<PlaceFacts>({
    loaded: !getSupabaseEnv(),
    hours: EMPTY_INDEX,
    spaceIds: EMPTY_IDS,
    buildingSlugs: EMPTY_IDS,
  });

  useEffect(() => {
    if (!getSupabaseEnv()) return;
    const supabase = createClient();
    let cancelled = false;

    Promise.all([
      readAll<HourRecord>((from, to) => supabase.from("opening_hours").select(HOUR_SELECT).order("id").range(from, to)),
      readAll<BookableRecord>((from, to) =>
        supabase
          .from("bookable_items")
          .select("space_id, building_slug")
          .eq("is_listed", true)
          .order("instance")
          .order("libcal_item_id")
          .range(from, to),
      ),
    ])
      .then(([hours, items]) => {
        if (cancelled) return;
        const spaceIds = new Set<string>();
        const buildingSlugs = new Set<string>();
        for (const item of items) {
          if (item.space_id) spaceIds.add(item.space_id);
          if (item.building_slug) buildingSlugs.add(item.building_slug);
        }
        setFacts({ loaded: true, hours: indexHours(hours.map(toHour)), spaceIds, buildingSlugs });
      })
      .catch((error: unknown) => {
        console.error("Home catalog failed to load", error);
        if (!cancelled) setFacts({ loaded: true, hours: EMPTY_INDEX, spaceIds: EMPTY_IDS, buildingSlugs: EMPTY_IDS });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return facts;
}

/** Listed spaces with hours, brightness and bookable items filled in. */
export function useHomeCatalog(): { spaces: HomeSpace[]; loaded: boolean } {
  const { data } = useMapState();
  const facts = usePlaceFacts();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const spaces = useMemo(() => {
    if (!data.loaded || !facts.loaded) return [];
    return data.spaces.map((space) =>
      describeSpace(
        space,
        hoursForSpace(space, facts.hours, now),
        spaceIsBookable(space, facts.spaceIds, facts.buildingSlugs),
        now,
      ),
    );
  }, [data.loaded, data.spaces, facts, now]);

  return { spaces, loaded: data.loaded && facts.loaded };
}
