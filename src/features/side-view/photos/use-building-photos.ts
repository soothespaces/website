"use client";

import { useEffect, useState } from "react";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { photoSpace, photosForSpace, type GalleryPhoto, type SpaceRef } from "./photo-model";

type PhotoRecord = {
  id: string;
  building_slug: string | null;
  space_id: string | null;
  path_prefix: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
  credit: string;
  license: string;
  source_url: string | null;
  sort_order: number;
  is_listed: boolean;
  kind: string;
  floor: number | null;
  room_number: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

type SpaceRecord = { id: string; slug: string; name: string; floor: number | null; building_slug: string };

type LocationRecord = {
  space_id: string;
  floor: number;
  room_number: string | null;
  area: unknown;
};

const PHOTO_SELECT =
  "id, building_slug, space_id, path_prefix, widths, width, height, alt, credit, license, source_url, sort_order, is_listed, kind, floor, room_number, lat, lng, created_at";

function toGalleryPhoto(record: PhotoRecord): GalleryPhoto {
  return {
    id: record.id,
    pathPrefix: record.path_prefix,
    widths: record.widths ?? [],
    width: record.width,
    height: record.height,
    alt: record.alt,
    credit: record.credit,
    license: record.license,
    sourceUrl: record.source_url,
    sortOrder: record.sort_order,
    kind: record.kind,
    floor: record.floor,
    roomNumber: record.room_number,
    lat: record.lat,
    lng: record.lng,
    spaceId: record.space_id,
    buildingSlug: record.building_slug,
    spaceName: null,
    spaceSlug: null,
    createdAt: record.created_at,
    isListed: record.is_listed,
  };
}

function spacesFor(rows: readonly SpaceRecord[], locations: readonly LocationRecord[]): SpaceRef[] {
  return rows.map((space) => ({
    id: space.id,
    slug: space.slug,
    name: space.name,
    buildingSlug: space.building_slug,
    locations: locations
      .filter((location) => location.space_id === space.id)
      .map((location) => ({
        floor: location.floor,
        roomNumber: location.room_number,
        area: location.area,
      })),
  }));
}

function placePhoto(photo: GalleryPhoto, spaces: readonly SpaceRef[]): GalleryPhoto {
  const match = photoSpace(photo, spaces);
  if (!match) return photo;
  return { ...photo, spaceName: match.name, spaceSlug: match.slug };
}

export type BuildingPhotosState = {
  buildingName: string;
  photos: GalleryPhoto[];
  loaded: boolean;
  error: string | null;
};

const EMPTY: BuildingPhotosState = { buildingName: "", photos: [], loaded: false, error: null };

export function useBuildingPhotos(slug: string, spaceSlug?: string): BuildingPhotosState {
  const key = `${slug}:${spaceSlug ?? ""}`;
  const [state, setState] = useState<BuildingPhotosState & { key: string }>({ ...EMPTY, key: "" });

  useEffect(() => {
    if (!getSupabaseEnv() || !slug) return;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const [buildingResult, spaceRows, buildingPhotos] = await Promise.all([
        supabase.from("buildings").select("name, short_name").eq("slug", slug).maybeSingle(),
        readAll<SpaceRecord>((from, to) =>
          supabase
            .from("spaces")
            .select("id, slug, name, floor, building_slug")
            .eq("building_slug", slug)
            .range(from, to),
        ),
        readAll<PhotoRecord>((from, to) =>
          supabase.from("photos").select(PHOTO_SELECT).eq("is_listed", true).eq("building_slug", slug).range(from, to),
        ),
      ]);
      if (buildingResult.error) throw buildingResult.error;

      const ids = spaceRows.map((space) => space.id);
      const [locations, spacePhotos] = await Promise.all([
        ids.length
          ? readAll<LocationRecord>((from, to) =>
              supabase
                .from("space_locations")
                .select("space_id, floor, room_number, area")
                .in("space_id", ids)
                .range(from, to),
            )
          : Promise.resolve([]),
        ids.length
          ? readAll<PhotoRecord>((from, to) =>
              supabase.from("photos").select(PHOTO_SELECT).eq("is_listed", true).in("space_id", ids).range(from, to),
            )
          : Promise.resolve([]),
      ]);

      const spaces = spacesFor(spaceRows, locations);
      const rows = new Map<string, GalleryPhoto>();
      for (const row of [...buildingPhotos, ...spacePhotos]) {
        if (!row.is_listed) continue;
        const photo = placePhoto(toGalleryPhoto(row), spaces);
        rows.set(photo.id, photo);
      }
      let photos = [...rows.values()];
      if (spaceSlug) {
        const space = spaces.find((item) => item.slug === spaceSlug);
        photos = space ? photosForSpace(photos, space, spaces) : [];
      }

      const building = buildingResult.data;
      return {
        buildingName: building?.short_name?.trim() || building?.name || "",
        photos,
      };
    }

    load()
      .then((result) => {
        if (!cancelled) setState({ key, ...result, loaded: true, error: null });
      })
      .catch((error: unknown) => {
        console.error("Photos failed to load", error);
        if (!cancelled) setState({ key, buildingName: "", photos: [], loaded: true, error: "Photos failed to load." });
      });

    return () => {
      cancelled = true;
    };
  }, [key, slug, spaceSlug]);

  if (!getSupabaseEnv()) {
    return { buildingName: "", photos: [], loaded: true, error: "Supabase isn't configured." };
  }
  if (state.key !== key) return EMPTY;
  return { buildingName: state.buildingName, photos: state.photos, loaded: state.loaded, error: state.error };
}
