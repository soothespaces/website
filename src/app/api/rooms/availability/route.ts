import { detroitParts } from "@/lib/detroit";
import { isLibcalInstance, isUnavailable, loadBookedSlots, type LibcalLocation } from "@/lib/data/libcal";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const UNAVAILABLE = { status: "unavailable" } as const;

function unavailable() {
  return Response.json(UNAVAILABLE, { headers: { "Cache-Control": "no-store" } });
}

// Today's booked LibCal slots for one building. The browser never calls LibCal
// (ADR 0008). A failure is a normal JSON body so the rooms screen can say
// "Availability unavailable" instead of breaking.
export async function GET(request: Request) {
  const buildingSlug = new URL(request.url).searchParams.get("buildingSlug") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(buildingSlug) || !getSupabaseEnv()) return unavailable();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookable_items")
      .select("instance, lid, kind, libcal_item_id")
      .eq("building_slug", buildingSlug)
      .eq("is_listed", true)
      .eq("kind", "space");
    if (error) throw error;

    const locations = new Map<string, LibcalLocation>();
    for (const row of data ?? []) {
      if (!isLibcalInstance(row.instance)) throw new Error(`Unknown LibCal instance ${row.instance}`);
      const key = `${row.instance}|${row.lid}`;
      const location = locations.get(key) ?? { instance: row.instance, lid: row.lid, kind: "space" as const, itemIds: [] };
      location.itemIds.push(row.libcal_item_id);
      locations.set(key, location);
    }

    const result = await loadBookedSlots([...locations.values()], detroitParts(new Date()).date);
    if (isUnavailable(result)) return unavailable();
    return Response.json(result, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("Room availability failed", error);
    return unavailable();
  }
}
