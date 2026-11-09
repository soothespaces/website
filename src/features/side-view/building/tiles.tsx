"use client";

import { useMemo } from "react";
import { ErrorNote } from "@/components/ui/error-note";
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile";
import { useMapState } from "@/features/map/map-state";
import { isOpenNow, nextClose, openStatus, useOpeningHours } from "@/lib/data/opening-hours";
import { busynessWord, usePopularTimes, usualFor } from "@/lib/data/popular-times";
import { detroitParts } from "@/lib/detroit";
import { collectFloors } from "./floors";
import { useBookableFloors, useBuildingProfile } from "./queries";

// Hours, floors, and busyness. A tile with nothing behind it is left out
// (a building without popular times shows two) instead of a dash.
export function BuildingTiles({ slug }: { slug: string | null }) {
  const { data, floorPlans, push } = useMapState();
  const hours = useOpeningHours(slug ? { buildingSlug: slug } : null);
  const popular = usePopularTimes(slug);
  const profile = useBuildingProfile(slug);
  const rooms = useBookableFloors(slug);
  const now = new Date();

  const status = hours.loaded ? openStatus(hours.hours, now) : null;
  // "Open until Fri 6 PM" already names the close, so the tile doesn't repeat it.
  const close = hours.loaded && !status?.startsWith("Open until ") ? nextClose(hours.hours, now) : null;
  const parts = detroitParts(now);
  const typical = popular.times?.busyness[parts.weekday]?.[parts.hour];
  const word = typical == null ? null : busynessWord(typical);
  const usual = popular.loaded ? usualFor(popular.times, now) : null;
  const floors = useMemo(() => {
    if (!slug) return null;
    const labels = data.spaces.filter((space) => space.building?.slug === slug).map((space) => space.floor_label);
    return collectFloors({
      planFloors: (floorPlans.get(slug) ?? []).map((plan) => plan.floor),
      labels,
      extraFloors: rooms.data,
      recordedCount: profile.data?.floors,
    });
  }, [slug, data.spaces, floorPlans, rooms.data, profile.data?.floors]);

  if (!slug) return null;
  // A failed read is not "no hours" (QA-024).
  const failed = Boolean(hours.error || popular.error);
  if (!status && !word && !floors) {
    return failed ? <ErrorNote message="Hours and busyness didn't load." className="px-1" /> : null;
  }

  const openHours = () => push({ kind: "hours", slug });
  const openChart = () => push({ kind: "hours", slug, focus: "chart" });

  return (
    <>
      {failed && !(status && word) ? <ErrorNote message="Hours and busyness didn't load." className="px-1" /> : null}
      <StatTileGrid>
        {status ? (
          <StatTile
            label="Hours"
            value={status}
            detail={close ?? undefined}
            tone={hours.hours && isOpenNow(hours.hours, now) ? "positive" : undefined}
            onClick={openHours}
          />
        ) : null}
        {floors ? <StatTile label="Floors" value={floors.value} detail={floors.detail} /> : null}
        {word && usual ? <StatTile label="Busyness" value={word} detail={usual} onClick={openChart} /> : null}
      </StatTileGrid>
    </>
  );
}
