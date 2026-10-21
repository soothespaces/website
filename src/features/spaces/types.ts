import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

// What lists, search and the detail view need to know about a study space.
export type SpaceSummary = Pick<
  Tables["spaces"]["Row"],
  "id" | "slug" | "name" | "summary" | "floor_label" | "noise_level" | "features" | "lat" | "lng"
> & { building: Pick<Tables["buildings"]["Row"], "slug" | "name" | "lat" | "lng"> | null };

// The PostgREST select for a SpaceSummary.
export const SPACE_SUMMARY_SELECT =
  "id, slug, name, summary, floor_label, noise_level, features, lat, lng, building:buildings(slug, name, lat, lng)";
