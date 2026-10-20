"use client";

import { useEffect, useState } from "react";
import { readAll } from "@/lib/data/read-all";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { GalleryPhoto } from "./photo-model";

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
  uploaded_by: string | null;
};

type SpaceRecord = { id: string; slug: string; name: string; floor: number | null };

const PHOTO_SELECT =
  "id, building_slug, space_id, path_prefix, widths, width, height, alt, credit, license, source_url, sort_order, is_listed, kind, floor, room_number, lat, lng, created_at, uploaded_by";

function toGalleryPhoto(record: PhotoRecord, space: SpaceRecord | undefined): GalleryPhoto {
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
    spaceName: space?.name ?? null,
    spaceSlug: space?.slug ?? null,
    spaceFloor: space?.floor ?? null,
    createdAt: record.created_at,
    uploadedBy: record.uploaded_by,
    isListed: record.is_listed,
  };
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
      const [buildingResult, spaces] = await Promise.all([
        supabase.from("buildings").select("name, short_name").eq("slug", slug).maybeSingle(),
        readAll<SpaceRecord>((from, to) =>
          supabase.from("spaces").select("id, slug, name, floor").eq("building_slug", slug).range(from, to),
        ),
      ]);
      if (buildingResult.error) throw buildingResult.error;

      const byId = new Map(spaces.map((space) => [space.id, space]));
      const target = spaceSlug ? spaces.find((space) => space.slug === spaceSlug) : undefined;
      const sets: PhotoRecord[][] = [];

      if (spaceSlug) {
        if (target) {
          sets.push(
            await readAll<PhotoRecord>((from, to) =>
              supabase
                .from("photos")
                .select(PHOTO_SELECT)
                .eq("is_listed", true)
                .eq("space_id", target.id)
                .range(from, to),
            ),
          );
        }
      } else {
        sets.push(
          await readAll<PhotoRecord>((from, to) =>
            supabase.from("photos").select(PHOTO_SELECT).eq("is_listed", true).eq("building_slug", slug).range(from, to),
          ),
        );
        const spaceIds = spaces.map((space) => space.id);
        if (spaceIds.length) {
          sets.push(
            await readAll<PhotoRecord>((from, to) =>
              supabase.from("photos").select(PHOTO_SELECT).eq("is_listed", true).in("space_id", spaceIds).range(from, to),
            ),
          );
        }
      }

      const photos = new Map<string, GalleryPhoto>();
      for (const row of sets.flat()) {
        if (!row.is_listed) continue;
        photos.set(row.id, toGalleryPhoto(row, row.space_id ? byId.get(row.space_id) : undefined));
      }
      const building = buildingResult.data;
      return {
        buildingName: building?.short_name?.trim() || building?.name || "",
        photos: [...photos.values()],
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
