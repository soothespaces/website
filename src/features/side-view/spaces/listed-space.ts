import type { Database } from "@/types/supabase";

type Enums = Database["public"]["Enums"];

// One listed study space, with the fields the Spaces screen ranks, filters and draws.
export type ListedSpace = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  floor: number | null;
  floor_label: string | null;
  noise_level: Enums["noise_level"] | null;
  light_level: Enums["light_level"] | null;
  features: readonly string[];
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  building_slug: string;
  building: {
    slug: string;
    name: string;
    short_name: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};
