"use client";

import { useEffect, useState } from "react";
import { photoUrl } from "@/features/admin-photos/photo";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { toSpaceDetail, type SpaceDetail, type SpaceDetailRow, type SpacePhotos } from "./detail";

const SPACE_DETAIL_SELECT =
  "id, slug, name, summary, description, floor, floor_label, noise_level, light_level, features, capacity, image_url, image_alt, source, edited_fields, lat, lng, building:buildings(slug, name, short_name, lat, lng), locations:space_locations(floor, room_number)";

export type SpaceDetailState = {
  space: SpaceDetail | null;
  loaded: boolean;
  error: string | null;
};

const EMPTY_PHOTOS: SpacePhotos = { count: 0, gallery: null };

function pickWidth(widths: readonly number[]): number | null {
  if (widths.length === 0) return null;
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((width) => width >= 960) ?? sorted[sorted.length - 1] ?? null;
}

async function loadPhotos(spaceId: string, supabaseUrl: string): Promise<SpacePhotos> {
  const supabase = createClient();
  const { data, count, error } = await supabase
    .from("photos")
    .select("alt, path_prefix, widths", { count: "exact" })
    .eq("space_id", spaceId)
    .eq("is_listed", true)
    .order("sort_order")
    .order("created_at")
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  const width = row ? pickWidth(row.widths) : null;
  const gallery = row && width != null ? { src: photoUrl(supabaseUrl, row.path_prefix, width), alt: row.alt } : null;
  return { count: count ?? 0, gallery };
}

// The map list is a short summary. The screen also needs the id, the photo,
// hours subject, attributes, and where the space sits on a floor plan.
export function useSpaceDetail(slug: string | null): SpaceDetailState {
  const [state, setState] = useState<SpaceDetailState & { key: string }>({
    key: "",
    space: null,
    loaded: false,
    error: null,
  });

  useEffect(() => {
    if (!getSupabaseEnv() || !slug) return;
    const supabase = createClient();
    const env = getSupabaseEnv();
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("spaces")
          .select(SPACE_DETAIL_SELECT)
          .eq("slug", slug)
          .eq("is_listed", true)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (!data) {
          setState({ key: slug, space: null, loaded: true, error: null });
          return;
        }
        let photos = EMPTY_PHOTOS;
        if (env) {
          try {
            photos = await loadPhotos(data.id, env.url);
          } catch (photoError) {
            console.error("Space photos failed to load", photoError);
          }
        }
        if (cancelled) return;
        setState({
          key: slug,
          space: toSpaceDetail(data as SpaceDetailRow, photos),
          loaded: true,
          error: null,
        });
      } catch (error) {
        console.error("Space detail failed to load", error);
        if (!cancelled) setState({ key: slug, space: null, loaded: true, error: "This space couldn’t be loaded." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return { space: null, loaded: true, error: null };
  if (!getSupabaseEnv()) return { space: null, loaded: true, error: "Supabase isn't configured." };
  if (state.key !== slug) return { space: null, loaded: false, error: null };
  return { space: state.space, loaded: state.loaded, error: state.error };
}
