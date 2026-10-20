"use client";

import { useEffect, useState } from "react";
import { photoUrl } from "@/features/admin-photos/photo";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { ListedSpace } from "./listed-space";

type BuildingRecord = {
  slug: string;
  name: string;
  short_name: string | null;
  lat: number | null;
  lng: number | null;
};

type SpaceRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  floor: number | null;
  floor_label: string | null;
  noise_level: ListedSpace["noise_level"];
  light_level: ListedSpace["light_level"];
  features: string[] | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  image_alt: string | null;
  building: BuildingRecord | BuildingRecord[] | null;
};

type PhotoRecord = {
  space_id: string | null;
  alt: string;
  path_prefix: string;
  widths: number[];
};

const SPACE_SELECT =
  "id, slug, name, summary, floor, floor_label, noise_level, light_level, features, capacity, lat, lng, image_url, image_alt, building:buildings(slug, name, short_name, lat, lng)";

export type BuildingSpacesState = {
  spaces: ListedSpace[];
  bookableByFloor: Map<number, number>;
  loaded: boolean;
  error: string | null;
};

const NO_COUNTS = new Map<number, number>();

function oneBuilding(value: SpaceRecord["building"]): BuildingRecord | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// Library pages store their own photo on the space. Google imagery stays off the row.
export function safeSpaceImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (/(?:^|\.)(?:googleusercontent|ggpht)\.com$/i.test(parsed.hostname)) return null;
    if (parsed.hostname === "maps.googleapis.com") return null;
    return url;
  } catch {
    return null;
  }
}

function toListedSpace(record: SpaceRecord, photo: { url: string; alt: string } | undefined): ListedSpace {
  const building = oneBuilding(record.building);
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    summary: record.summary,
    floor: record.floor,
    floor_label: record.floor_label,
    noise_level: record.noise_level,
    light_level: record.light_level,
    features: record.features ?? [],
    capacity: record.capacity,
    lat: record.lat,
    lng: record.lng,
    imageUrl: photo?.url ?? safeSpaceImageUrl(record.image_url),
    imageAlt: photo?.alt ?? record.image_alt,
    building_slug: building?.slug ?? "",
    building,
  };
}

function countFloors(rows: readonly { floor: number | null }[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.floor == null) continue;
    counts.set(row.floor, (counts.get(row.floor) ?? 0) + 1);
  }
  return counts;
}

export function useBuildingSpaces(buildingSlug: string | null): BuildingSpacesState {
  const [state, setState] = useState<BuildingSpacesState & { key: string }>(() => ({
    key: "",
    spaces: [],
    bookableByFloor: NO_COUNTS,
    loaded: false,
    error: null,
  }));

  useEffect(() => {
    if (!getSupabaseEnv() || !buildingSlug) return;
    const supabase = createClient();
    const env = getSupabaseEnv();
    let cancelled = false;

    Promise.all([
      readAll<SpaceRecord>((from, to) =>
        supabase
          .from("spaces")
          .select(SPACE_SELECT)
          .eq("building_slug", buildingSlug)
          .eq("is_listed", true)
          .order("name")
          .range(from, to),
      ),
      readAll<PhotoRecord>((from, to) =>
        supabase
          .from("photos")
          .select("space_id, alt, path_prefix, widths")
          .eq("building_slug", buildingSlug)
          .eq("is_listed", true)
          .not("space_id", "is", null)
          .order("sort_order")
          .order("id")
          .range(from, to),
      ),
      readAll<{ floor: number | null }>((from, to) =>
        supabase.from("bookable_items").select("floor").eq("building_slug", buildingSlug).eq("is_listed", true).range(from, to),
      ),
    ])
      .then(([spaces, photos, bookable]) => {
        if (cancelled || !env) return;
        const firstPhoto = new Map<string, { url: string; alt: string }>();
        for (const photo of photos) {
          if (!photo.space_id || firstPhoto.has(photo.space_id) || photo.widths.length === 0) continue;
          const width = Math.min(...photo.widths);
          firstPhoto.set(photo.space_id, { url: photoUrl(env.url, photo.path_prefix, width), alt: photo.alt });
        }
        setState({
          key: buildingSlug,
          spaces: spaces.map((row) => toListedSpace(row, firstPhoto.get(row.id))),
          bookableByFloor: countFloors(bookable),
          loaded: true,
          error: null,
        });
      })
      .catch((error: unknown) => {
        console.error("Study spaces failed to load", error);
        if (!cancelled) {
          setState({
            key: buildingSlug,
            spaces: [],
            bookableByFloor: NO_COUNTS,
            loaded: true,
            error: "Study spaces failed to load.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [buildingSlug]);

  if (!getSupabaseEnv()) {
    return { spaces: [], bookableByFloor: NO_COUNTS, loaded: true, error: "Supabase isn't configured." };
  }
  if (!buildingSlug) return { spaces: [], bookableByFloor: NO_COUNTS, loaded: true, error: null };
  if (state.key !== buildingSlug) return { spaces: [], bookableByFloor: NO_COUNTS, loaded: false, error: null };
  return {
    spaces: state.spaces,
    bookableByFloor: state.bookableByFloor,
    loaded: state.loaded,
    error: state.error,
  };
}
