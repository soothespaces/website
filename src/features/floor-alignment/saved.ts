import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Corners } from "./geometry";
import type { FloorRecord } from "./floors";

/** An alignment an admin saved from the editor (public.floor_alignments). */
export type SavedAlignment = {
  sheet: string;
  sha256: string;
  width: number;
  height: number;
  corners: Corners;
  alignedBy: string;
  alignedAt: string;
};

export async function getSavedAlignments(): Promise<Map<string, SavedAlignment>> {
  if (!getSupabaseEnv()) return new Map();
  const supabase = await createClient();
  // aligned_by isn't readable through the API; admins get it from
  // floor_alignment_authors(), which returns nothing for anyone else.
  const [{ data, error }, authors] = await Promise.all([
    supabase.from("floor_alignments").select("sheet, sha256, width, height, corners, aligned_at"),
    supabase.rpc("floor_alignment_authors"),
  ]);
  if (error) throw new Error(`Couldn't read floor alignments: ${error.message}`);
  const by = new Map((authors.data ?? []).map((a) => [a.sheet, a.aligned_by]));
  return new Map(
    data.map((row) => [
      row.sheet,
      {
        sheet: row.sheet,
        sha256: row.sha256,
        width: row.width,
        height: row.height,
        corners: row.corners as Corners,
        alignedBy: by.get(row.sheet) ?? "an admin",
        alignedAt: row.aligned_at,
      },
    ]),
  );
}

/**
 * A saved alignment applies only to the sheet it was made on. If MPrint has
 * since replaced the sheet, the pipeline ignores it and so does the editor.
 */
export function savedFor(record: FloorRecord, saved: Map<string, SavedAlignment>) {
  const row = saved.get(record.sheet);
  if (!row || row.sha256 !== record.sha256 || row.width !== record.width || row.height !== record.height) {
    return null;
  }
  return row;
}

/** Whether the map already shows these corners (the pipeline has run since the save). */
export function isOnMap(record: FloorRecord, row: SavedAlignment) {
  return (
    record.aligned === "manual" &&
    row.corners.every((c, i) => c[0] === record.corners[i][0] && c[1] === record.corners[i][1])
  );
}
