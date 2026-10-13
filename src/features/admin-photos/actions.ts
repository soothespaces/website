"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { floorsFor } from "./data";
import {
  BUCKET,
  UPLOAD_MAX_BYTES,
  WEBP_QUALITY,
  widthsFor,
  type PhotoDetails,
  type PhotoKind,
  type PhotoTags,
} from "./photo";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const NOT_ADMIN = { ok: false, error: "Only admins can change photos." } as const;
const MAX_BYTES = 5 * 1024 * 1024; // the bucket's file_size_limit

// Uploads a photo the browser has already downscaled (resize.ts): makes the
// same WebP widths as scripts/photos/import.mjs, uploads them as the signed-in
// admin (Storage RLS lets only admins write to the bucket), then adds the row.
export async function uploadPhoto(form: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose a photo to upload." };
  if (file.size > UPLOAD_MAX_BYTES) return { ok: false, error: "The photo is too large. Try a smaller one." };
  const parsed = parse(form.get("tags"), form.get("details"));
  if (!parsed.ok) return parsed;
  const { tags, details } = parsed;

  const original = Buffer.from(await file.arrayBuffer());
  // rotate() applies the EXIF orientation; output drops all metadata.
  const oriented = await sharp(original)
    .rotate()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!oriented) return { ok: false, error: "That file isn't an image this server can read. Try a JPEG or PNG." };
  const { width, height } = oriented.info;
  if (details.kind === "panorama" && Math.abs(width / height - 2) > 0.02) {
    return { ok: false, error: `A panorama must be a 2:1 equirectangular image; this one is ${width}×${height}.` };
  }

  // Named by a hash of the uploaded bytes, like the import script, so a
  // re-upload of the same file is caught and a replaced file never hits a
  // stale cache.
  const hash = createHash("sha256").update(original).digest("hex").slice(0, 16);
  const prefix = `buildings/${tags.buildingSlug}/${hash}`;
  const widths = widthsFor(details.kind, width);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("photos")
    .select("id")
    .eq("path_prefix", `${BUCKET}/${prefix}`)
    .maybeSingle();
  if (existing) return { ok: false, error: "This photo is already uploaded for this building." };

  const uploaded: string[] = [];
  for (const w of widths) {
    const webp = await sharp(oriented.data).resize({ width: w }).webp({ quality: WEBP_QUALITY }).toBuffer();
    if (webp.length > MAX_BYTES) return cleanUp(uploaded, `The ${w} px version is over the 5 MB limit.`);
    const path = `${prefix}-${w}.webp`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) return cleanUp(uploaded, `Uploading failed: ${error.message}`);
    uploaded.push(path);
  }

  const { data, error } = await supabase
    .from("photos")
    .insert({
      ...row(tags, details),
      path_prefix: `${BUCKET}/${prefix}`,
      widths,
      width,
      height,
      source_url: null,
      // The database replaces this with the signed-in admin's email.
      uploaded_by: "",
    })
    .select("id")
    .single();
  if (error) return cleanUp(uploaded, `Saving the photo failed: ${error.message}`);

  revalidatePath("/admin/photos", "layout");
  return { ok: true, id: data.id };

  async function cleanUp(paths: string[], message: string): Promise<ActionResult> {
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    return { ok: false, error: message };
  }
}

/** Re-tags a photo or changes its alt text, credit, license or listing. */
export async function updatePhoto(id: string, tags: unknown, details: unknown): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const parsed = parse(tags, details);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data: current } = await supabase.from("photos").select("kind").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "That photo no longer exists." };
  // The stored widths depend on the kind, so it can't change after upload.
  const { data, error } = await supabase
    .from("photos")
    .update(row(parsed.tags, { ...parsed.details, kind: current.kind as PhotoKind }))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: `Saving failed: ${error.message}` };
  if (!data) return { ok: false, error: "That photo no longer exists." };
  revalidatePath("/admin/photos", "layout");
  return { ok: true, id };
}

/** Removes a photo's files and its row. */
export async function deletePhoto(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const supabase = await createClient();
  const { data: photo } = await supabase.from("photos").select("path_prefix, widths").eq("id", id).maybeSingle();
  if (!photo) return { ok: false, error: "That photo no longer exists." };
  const files = photo.widths.map((w) => `${photo.path_prefix.slice(BUCKET.length + 1)}-${w}.webp`);
  const removed = await supabase.storage.from(BUCKET).remove(files);
  if (removed.error) return { ok: false, error: `Removing the files failed: ${removed.error.message}` };
  const { error } = await supabase.from("photos").delete().eq("id", id);
  if (error) return { ok: false, error: `Removing the photo failed: ${error.message}` };
  revalidatePath("/admin/photos", "layout");
  return { ok: true, id };
}

function row(tags: PhotoTags, details: PhotoDetails) {
  return {
    building_slug: tags.buildingSlug,
    space_id: null,
    floor: tags.floor,
    room_number: tags.roomNumber,
    lat: tags.lat,
    lng: tags.lng,
    heading: tags.heading,
    alt: details.alt,
    credit: details.credit,
    license: details.license,
    kind: details.kind,
    is_listed: details.isListed,
  };
}

type Parsed = { ok: true; tags: PhotoTags; details: PhotoDetails } | { ok: false; error: string };

// Form values arrive from the browser, so check every field here; the
// database checks again (constraints, foreign keys, RLS).
function parse(rawTags: unknown, rawDetails: unknown): Parsed {
  const tags = json(rawTags);
  const details = json(rawDetails);
  if (!tags || !details) return { ok: false, error: "The form was incomplete. Reload and try again." };

  const buildingSlug = text(tags.buildingSlug);
  if (!buildingSlug || !/^[a-z0-9-]+$/.test(buildingSlug)) return { ok: false, error: "Choose a building." };
  const floor = tags.floor == null ? null : Number(tags.floor);
  if (floor != null && !floorsFor(buildingSlug).some((f) => f.floor === floor)) {
    return { ok: false, error: "That floor has no floor plan to tag." };
  }
  const roomNumber = text(tags.roomNumber);
  const lat = tags.lat == null ? null : Number(tags.lat);
  const lng = tags.lng == null ? null : Number(tags.lng);
  const heading = tags.heading == null ? null : Number(tags.heading);
  if ((roomNumber || lat != null) && floor == null) return { ok: false, error: "Choose a floor for the room or spot." };
  if ((lat == null) !== (lng == null)) return { ok: false, error: "The spot needs both coordinates." };
  if (lat != null && !(Math.abs(lat) <= 90 && Math.abs(lng!) <= 180)) return { ok: false, error: "The spot is off the map." };
  if (heading != null && (lat == null || !Number.isInteger(heading) || heading < 0 || heading > 359)) {
    return { ok: false, error: "A direction needs a spot and must be 0–359°." };
  }

  const alt = text(details.alt);
  const credit = text(details.credit);
  const license = text(details.license);
  if (!alt) return { ok: false, error: "Describe the photo for people who can't see it (alt text)." };
  if (!credit || !license) return { ok: false, error: "Fill in the credit and license." };
  const kind = details.kind === "panorama" ? "panorama" : "photo";

  return {
    ok: true,
    tags: { buildingSlug, floor, roomNumber, lat, lng, heading },
    details: { alt, credit, license, kind, isListed: details.isListed !== false },
  };
}

function json(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
