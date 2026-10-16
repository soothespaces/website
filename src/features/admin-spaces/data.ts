import "server-only";
import { floorsFor, type TaggableFloor } from "@/features/admin-photos/data";
import { createClient } from "@/lib/supabase/server";
import type { AdminSpace, Ring, SpaceLocation } from "./space";

export type SpaceBuilding = {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Floors with a vector plan on the map, where rooms and areas can be picked. */
  floors: TaggableFloor[];
};

/** Every building, the ones with floor plans first. */
export async function getSpaceBuildings(): Promise<SpaceBuilding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buildings").select("slug, name, lat, lng").order("name");
  if (error) throw new Error(`Couldn't read buildings: ${error.message}`);
  const buildings = data.map((b) => ({ ...b, floors: floorsFor(b.slug) }));
  return [...buildings.filter((b) => b.floors.length), ...buildings.filter((b) => !b.floors.length)];
}

export type SpaceRow = {
  slug: string;
  name: string;
  buildingSlug: string;
  buildingName: string;
  floorLabel: string | null;
  isListed: boolean;
  source: AdminSpace["source"];
  onMap: boolean;
  edited: number;
};

/** Every space, listed or not (admins can read them all), by building then name. */
export async function getSpaceRows(building?: string): Promise<SpaceRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("spaces")
    .select("slug, name, building_slug, floor_label, is_listed, source, lat, edited_fields, building:buildings(name)")
    .order("building_slug")
    .order("name");
  if (building) query = query.eq("building_slug", building);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't read spaces: ${error.message}`);
  return data.map((s) => ({
    slug: s.slug,
    name: s.name,
    buildingSlug: s.building_slug,
    buildingName: s.building?.name ?? s.building_slug,
    floorLabel: s.floor_label,
    isListed: s.is_listed,
    source: s.source,
    onMap: s.lat != null,
    edited: s.edited_fields.length,
  }));
}

export async function getSpace(slug: string): Promise<AdminSpace | null> {
  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("spaces")
    .select(
      "id, slug, building_slug, name, summary, description, floor, floor_label, noise_level, light_level, features, capacity, is_listed, lat, lng, source, source_url, edited_fields, locations:space_locations(id, floor, room_number, area)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't read the space: ${error.message}`);
  if (!s) return null;
  const locations: SpaceLocation[] = s.locations
    .map((l) => ({
      id: l.id,
      floor: l.floor,
      roomNumber: l.room_number,
      area: l.area ? ((l.area as { coordinates: Ring[] }).coordinates[0] ?? null) : null,
    }))
    .sort((a, b) => a.floor - b.floor || (a.roomNumber ?? "").localeCompare(b.roomNumber ?? "", undefined, { numeric: true }));
  return {
    id: s.id,
    slug: s.slug,
    buildingSlug: s.building_slug,
    name: s.name,
    summary: s.summary,
    description: s.description,
    floor: s.floor,
    floorLabel: s.floor_label,
    noiseLevel: s.noise_level,
    lightLevel: s.light_level,
    features: s.features,
    capacity: s.capacity,
    isListed: s.is_listed,
    lat: s.lat,
    lng: s.lng,
    source: s.source,
    sourceUrl: s.source_url,
    editedFields: s.edited_fields,
    locations,
  };
}
