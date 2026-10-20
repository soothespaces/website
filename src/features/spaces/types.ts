import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

// What lists, search and the detail view need to know about a study space.
export type SpaceSummary = Pick<
  Tables["spaces"]["Row"],
  "slug" | "name" | "summary" | "floor_label" | "noise_level" | "features" | "lat" | "lng"
> & {
  id?: string;
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
// the building's short name; lists only read the fields they already did.
export const SPACE_SUMMARY_SELECT =
  "id, slug, name, summary, floor_label, noise_level, light_level, features, capacity, lat, lng, image_url, image_alt, source, edited_fields, building:buildings(slug, name, short_name, lat, lng)";
