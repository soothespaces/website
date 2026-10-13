"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { findSheet } from "./floors";

export type SaveResult = { ok: true; alignedAt: string } | { ok: false; error: string };

// Saves the editor's corners to public.floor_alignments. RLS only lets
// admins write; this checks first so non-admins get a clear message.
export async function saveAlignment(sheet: string, corners: unknown): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can save alignments." };
  const record = findSheet(sheet);
  if (!record) return { ok: false, error: `Unknown sheet ${sheet}.` };
  if (!isCorners(corners)) return { ok: false, error: "The corners aren't four longitude, latitude pairs." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floor_alignments")
    .upsert({
      sheet: record.sheet,
      sha256: record.sha256,
      width: record.width,
      height: record.height,
      corners,
      // The database replaces this with the signed-in user's email.
      aligned_by: "",
    })
    .select("aligned_at")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/floors", "layout");
  return { ok: true, alignedAt: data.aligned_at };
}

function isCorners(value: unknown): value is [number, number][] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (c) =>
        Array.isArray(c) &&
        c.length === 2 &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]) &&
        Math.abs(c[0]) <= 180 &&
        Math.abs(c[1]) <= 90,
    )
  );
}
