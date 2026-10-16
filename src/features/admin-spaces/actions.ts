"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { floorsFor } from "@/features/admin-photos/data";
import type { Database } from "@/types/supabase";
import {
  LIGHT_LEVELS,
  NOISE_LEVELS,
  manualSlug,
  type Ring,
  type SpaceFeature,
  type SpaceFields,
  type SpaceLocation,
} from "./space";

type SpaceUpdate = Database["public"]["Tables"]["spaces"]["Update"];

export type ActionResult = { ok: true; slug: string } | { ok: false; error: string };

const NOT_ADMIN = { ok: false, error: "Only admins can change spaces." } as const;

const FEATURES: SpaceFeature[] = [
  "natural_light",
  "wheelchair_accessible",
  "all_gender_restroom_on_floor",
  "whiteboards",
  "bookable",
  "external_monitors",
  "outlets",
  "computers",
  "printing",
  "scanners",
  "group_rooms",
];

// Saves a space and where it is. A new space (no id) is added by hand with a
// manual- slug; for an existing one, `editedFields` is the list after any
// unlocking, and the database adds whatever this save changes.
export async function saveSpace(input: {
  id: string | null;
  buildingSlug: string;
  fields: SpaceFields;
  editedFields: string[];
  locations: SpaceLocation[];
}): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const problem = check(input.fields) ?? checkLocations(input.buildingSlug, input.locations);
  if (problem) return { ok: false, error: problem };
  const supabase = await createClient();
  const row = toRow(input.fields);

  let id = input.id;
  let slug: string;
  if (id) {
    const { data: current, error: readError } = await supabase
      .from("spaces")
      .select("slug, edited_fields, name, summary, description, floor, floor_label, noise_level, light_level, features, capacity, is_listed, lat, lng")
      .eq("id", id)
      .maybeSingle();
    if (readError) return { ok: false, error: `Reading the space failed: ${readError.message}` };
    if (!current) return { ok: false, error: "That space no longer exists." };
    slug = current.slug;
    // Write only what the admin changed, so the database marks just those
    // columns as edited (and the seed keeps updating the rest).
    const changes: SpaceUpdate = Object.fromEntries(
      Object.entries(row).filter(([key, value]) => !same(value, current[key as keyof typeof current])),
    );
    const editedFields = input.editedFields.filter((f) => typeof f === "string").sort();
    if (editedFields.join() !== [...current.edited_fields].sort().join()) changes.edited_fields = editedFields;
    if (Object.keys(changes).length) {
      const { error } = await supabase.from("spaces").update(changes).eq("id", id);
      if (error) return { ok: false, error: `Saving failed: ${error.message}` };
    }
  } else {
    if (!input.buildingSlug) return { ok: false, error: "Choose a building." };
    slug = await freeSlug(manualSlug(input.fields.name));
    const { data, error } = await supabase
      .from("spaces")
      .insert({ ...row, slug, building_slug: input.buildingSlug, source: "manual" })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Adding the space failed: ${error.message}` };
    id = data.id;
  }

  // Locations are added and removed, never changed: keep the saved ones still
  // in the list, remove the rest, add the new ones.
  const { data: saved, error: readError } = await supabase.from("space_locations").select("id").eq("space_id", id);
  if (readError) return { ok: false, error: `Reading its locations failed: ${readError.message}` };
  const keep = new Set(input.locations.flatMap((l) => (l.id ? [l.id] : [])));
  const removed = saved.map((l) => l.id).filter((savedId) => !keep.has(savedId));
  if (removed.length) {
    const { error } = await supabase.from("space_locations").delete().in("id", removed);
    if (error) return { ok: false, error: `Removing locations failed: ${error.message}` };
  }
  const added = input.locations.filter((l) => !l.id);
  if (added.length) {
    const { error } = await supabase.from("space_locations").insert(
      added.map((l) => ({
        space_id: id,
        floor: l.floor,
        room_number: l.roomNumber,
        area: l.area ? { type: "Polygon", coordinates: [closed(l.area)] } : null,
      })),
    );
    if (error) return { ok: false, error: `Adding locations failed: ${error.message}` };
  }

  revalidatePath("/admin/spaces");
  revalidatePath(`/admin/spaces/${slug}`);
  return { ok: true, slug };
}

// Only spaces added here: the seed would bring back any other.
export async function deleteSpace(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { data, error } = await supabase.from("spaces").delete().eq("id", id).eq("source", "manual").select("id");
  if (error) return { ok: false, error: `Deleting failed: ${error.message}` };
  if (!data.length) return { ok: false, error: "Only spaces added here can be deleted. Hide the others instead." };
  revalidatePath("/admin/spaces");
  return { ok: true };
}

function toRow(f: SpaceFields) {
  return {
    name: f.name.trim(),
    summary: blank(f.summary),
    description: blank(f.description),
    floor: f.floor,
    floor_label: blank(f.floorLabel),
    noise_level: f.noiseLevel,
    light_level: f.lightLevel,
    features: [...new Set(f.features)],
    capacity: f.capacity,
    is_listed: f.isListed,
    lat: f.lat,
    lng: f.lng,
  };
}

function check(f: SpaceFields) {
  if (typeof f.name !== "string" || !f.name.trim()) return "Give the space a name.";
  if (f.floor != null && !(Number.isInteger(f.floor) && f.floor >= -5 && f.floor <= 30)) return "The floor must be a whole number (0 is the basement).";
  if (f.capacity != null && !(Number.isInteger(f.capacity) && f.capacity > 0)) return "Seats must be a whole number above 0.";
  if (f.noiseLevel != null && !NOISE_LEVELS.includes(f.noiseLevel)) return "Unknown noise level.";
  if (f.lightLevel != null && !LIGHT_LEVELS.includes(f.lightLevel)) return "Unknown brightness.";
  if (!Array.isArray(f.features) || f.features.some((x) => !FEATURES.includes(x))) return "Unknown amenity.";
  if ((f.lat == null) !== (f.lng == null)) return "The map pin needs both coordinates.";
  if (f.lat != null && !(Math.abs(f.lat) <= 90 && Math.abs(f.lng!) <= 180)) return "The map pin is off the map.";
  return null;
}

function checkLocations(buildingSlug: string, locations: SpaceLocation[]) {
  if (!Array.isArray(locations) || locations.length > 200) return "Too many locations.";
  const plans = new Set(floorsFor(buildingSlug).map((f) => f.floor));
  for (const l of locations) {
    if (l.id) continue;
    if (!plans.has(l.floor)) return `Floor ${l.floor} of this building has no floor plan to place it on.`;
    if ((l.roomNumber == null) === (l.area == null)) return "Each location is a room or an area.";
    if (l.roomNumber != null && (typeof l.roomNumber !== "string" || !l.roomNumber.trim())) return "A room needs its number.";
    if (l.area != null && !validRing(l.area)) return "An area needs at least three corners.";
  }
  return null;
}

function validRing(ring: Ring) {
  return (
    Array.isArray(ring) &&
    ring.length >= 3 &&
    ring.length <= 200 &&
    ring.every((p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
  );
}

function closed(ring: Ring): Ring {
  const [first, last] = [ring[0], ring.at(-1)!];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

// Amenities are a set; everything else compares by value.
function same(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return a === b;
}

function blank(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// manual-caen-lab, then manual-caen-lab-2, -3…
async function freeSlug(base: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("spaces").select("slug").like("slug", `${base}%`);
  const taken = new Set(data?.map((s) => s.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
