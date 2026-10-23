import "server-only";
import { floors } from "@/features/floor-alignment/floors";
import { plansByBuilding } from "@/features/map/floor-plan-index";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { AdminPhoto, PhotoKind } from "./photo";

type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];

export type BuildingOption = { slug: string; name: string; floors: TaggableFloor[] };

/** A floor whose vector plan is on the map, so photos can be tagged to its rooms. */
export type TaggableFloor = {
  floor: number;
  geojson: string;
  corners: [number, number][];
  labeled: boolean;
};

function taggableFloors() {
  const byBuilding = new Map<string, TaggableFloor[]>();
  for (const [building, plans] of plansByBuilding(floors)) {
    byBuilding.set(
      building,
      plans.map((f) => ({ floor: f.floor, geojson: f.geojson, corners: f.corners, labeled: f.labeled })),
    );
  }
  return byBuilding;
}

/** Every building, the ones with floor plans first. */
export async function getBuildingOptions(): Promise<BuildingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("buildings").select("slug, name").order("name");
  if (error) throw new Error(`Couldn't read buildings: ${error.message}`);
  const plans = taggableFloors();
  const options = data.map((b) => ({ ...b, floors: plans.get(b.slug) ?? [] }));
  return [...options.filter((b) => b.floors.length), ...options.filter((b) => !b.floors.length)];
}

export function floorsFor(buildingSlug: string) {
  return taggableFloors().get(buildingSlug) ?? [];
}

const COLUMNS =
  "id, building_slug, floor, room_number, lat, lng, heading, alt, credit, license, kind, is_listed, path_prefix, widths, width, height, source_url, uploaded_by, created_at";

function toPhoto(row: Pick<PhotoRow, keyof PhotoRow & string>): AdminPhoto {
  return {
    id: row.id,
    buildingSlug: row.building_slug ?? "",
    floor: row.floor,
    roomNumber: row.room_number,
    lat: row.lat,
    lng: row.lng,
    heading: row.heading,
    alt: row.alt,
    credit: row.credit,
    license: row.license,
    kind: row.kind as PhotoKind,
    isListed: row.is_listed,
    pathPrefix: row.path_prefix,
    widths: row.widths,
    width: row.width,
    height: row.height,
    sourceUrl: row.source_url,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export const PAGE_SIZE = 48;

/** Building photos, newest first. Admins see unlisted ones too (RLS). */
export async function getPhotos({
  building,
  uploaded,
  page,
}: {
  building?: string;
  /** Only photos uploaded from /admin (not imported by the script). */
  uploaded?: boolean;
  page: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("photos")
    .select(COLUMNS, { count: "exact" })
    .not("building_slug", "is", null)
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (building) query = query.eq("building_slug", building);
  if (uploaded) query = query.not("uploaded_by", "is", null);
  const { data, error, count } = await query;
  if (error) throw new Error(`Couldn't read photos: ${error.message}`);
  return { photos: data.map((row) => toPhoto(row as PhotoRow)), total: count ?? 0 };
}

export async function getPhoto(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("photos").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't read the photo: ${error.message}`);
  return data && data.building_slug ? toPhoto(data as PhotoRow) : null;
}
