import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

// What lists, search and the detail view need to know about a study space.
export type SpaceSummary = Pick<
  Tables["spaces"]["Row"],
  "id" | "slug" | "name" | "summary" | "floor_label" | "noise_level" | "features" | "lat" | "lng"
> & {
  light_level?: Tables["spaces"]["Row"]["light_level"];
  capacity?: number | null;
  image_url?: string | null;
  image_alt?: string | null;
  source?: Tables["spaces"]["Row"]["source"];
  edited_fields?: string[];
  building:
    | (Pick<Tables["buildings"]["Row"], "slug" | "name" | "lat" | "lng"> & {
        short_name?: string | null;
      })
    | null;
};

// The PostgREST select for a SpaceSummary. Home uses id, light, photos and
// the building's short name. Source and edited fields stay off this query;
// the dim chip reads the stored light level.
export const SPACE_SUMMARY_SELECT =
  "id, slug, name, summary, floor_label, noise_level, light_level, features, capacity, lat, lng, image_url, image_alt, building:buildings(slug, name, short_name, lat, lng)";
