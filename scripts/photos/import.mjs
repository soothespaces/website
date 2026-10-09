// Resizes every photo listed in scripts/photos/photos.json, uploads the WebP
// files to the public `photos` bucket and upserts their public.photos rows.
// See scripts/photos/README.md for the entry format.
//
//   node scripts/photos/import.mjs             import everything
//   node scripts/photos/import.mjs --dry-run   resize and validate, upload nothing
//   node scripts/photos/import.mjs --prune     also delete rows (and files) no
//                                              longer in photos.json
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY, from the environment
// or .env.local. The secret key bypasses RLS; never commit or expose it.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUCKET = "photos";
const QUALITY = 75;
// Panoramas are shown in a 360° viewer that zooms in, so they keep more pixels.
const WIDTHS = { photo: [480, 960, 1600], panorama: [2048, 4096] };
const MAX_BYTES = 5 * 1024 * 1024; // the bucket's file_size_limit

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prune = args.has("--prune");

try {
  process.loadEnvFile(resolve(HERE, "..", "..", ".env.local"));
} catch {
  // No .env.local; rely on the environment.
}

const entries = JSON.parse(await readFile(join(HERE, "photos.json"), "utf8"));
if (!Array.isArray(entries)) throw new Error("photos.json must be an array");

const supabase = dryRun
  ? null
  : createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false },
    });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see scripts/photos/README.md)`);
  return value;
}

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

function validate(entry, n) {
  const where = `photos.json[${n}]`;
  const fail = (message) => {
    throw new Error(`${where}: ${message}`);
  };
  if (!!entry.building_slug === !!entry.space_slug) fail("set exactly one of building_slug, space_slug");
  if (!entry.file && !entry.source_url) fail("set file, source_url, or both");
  const kind = entry.kind ?? "photo";
  if (!(kind in WIDTHS)) fail(`kind must be photo or panorama, got ${kind}`);
  for (const key of ["alt", "credit", "license"]) if (!text(entry[key])) fail(`${key} is required`);
  if ((entry.lat == null) !== (entry.lng == null)) fail("set lat and lng together");
  if (entry.lat != null && !(Math.abs(entry.lat) <= 90 && Math.abs(entry.lng) <= 180)) fail("lat/lng out of range");
  if (entry.heading != null && (entry.lat == null || !(entry.heading >= 0 && entry.heading < 360))) {
    fail("heading needs lat/lng and must be 0-359");
  }
  if (entry.floor != null && !Number.isInteger(entry.floor)) fail("floor must be an integer");
  return kind;
}

async function source(entry) {
  if (entry.file) return readFile(resolve(HERE, entry.file));
  const res = await fetch(entry.source_url);
  if (!res.ok) throw new Error(`${entry.source_url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const spaceIds = new Map();
async function spaceId(slug) {
  if (!spaceIds.has(slug)) {
    const { data, error } = await supabase.from("spaces").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Unknown space ${slug}`);
    spaceIds.set(slug, data.id);
  }
  return spaceIds.get(slug);
}

const keep = new Set();
for (const [n, entry] of entries.entries()) {
  const kind = validate(entry, n);
  const original = await source(entry);
  // rotate() applies the EXIF orientation; sharp drops all metadata (EXIF GPS
  // included) on output unless asked to keep it.
  const oriented = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = oriented.info;
  if (kind === "panorama" && Math.abs(width / height - 2) > 0.02) {
    throw new Error(`photos.json[${n}]: a panorama must be 2:1 equirectangular, got ${width}×${height}`);
  }
  // Content hash, so a replaced image gets a new path and the year-long cache
  // is never stale.
  const id = createHash("sha256").update(original).digest("hex").slice(0, 16);
  const folder = entry.building_slug ? `buildings/${entry.building_slug}` : `spaces/${entry.space_slug}`;
  const prefix = `${folder}/${id}`;
  const widths = WIDTHS[kind].filter((w) => w < width);
  if (widths.length < WIDTHS[kind].length) widths.push(width); // largest: original size, never upscaled

  for (const w of widths) {
    const webp = await sharp(oriented.data).resize({ width: w }).webp({ quality: QUALITY }).toBuffer();
    if (webp.length > MAX_BYTES) throw new Error(`${prefix}-${w}.webp is ${webp.length} bytes, over the bucket limit`);
    if (dryRun) continue;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${prefix}-${w}.webp`, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) throw error;
  }

  const row = {
    building_slug: entry.building_slug ?? null,
    space_id: entry.space_slug && !dryRun ? await spaceId(entry.space_slug) : null,
    path_prefix: `${BUCKET}/${prefix}`,
    widths,
    width,
    height,
    alt: text(entry.alt),
    credit: text(entry.credit),
    license: text(entry.license),
    source_url: text(entry.source_url),
    sort_order: entry.sort_order ?? 0,
    is_listed: entry.is_listed ?? true,
    kind,
    floor: entry.floor ?? null,
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    heading: entry.heading ?? null,
  };
  keep.add(row.path_prefix);
  if (!dryRun) {
    const { error } = await supabase.from("photos").upsert(row, { onConflict: "path_prefix" });
    if (error) throw error;
  }
  console.log(`${dryRun ? "checked" : "imported"} ${row.path_prefix} (${kind}, ${width}×${height}, widths ${widths.join("/")})`);
}

if (!dryRun) {
  const { data, error } = await supabase.from("photos").select("id, path_prefix, widths");
  if (error) throw error;
  const stale = data.filter((row) => !keep.has(row.path_prefix));
  for (const row of stale) {
    if (!prune) {
      console.log(`not in photos.json: ${row.path_prefix} (run with --prune to delete)`);
      continue;
    }
    const files = row.widths.map((w) => `${row.path_prefix.slice(BUCKET.length + 1)}-${w}.webp`);
    const removed = await supabase.storage.from(BUCKET).remove(files);
    if (removed.error) throw removed.error;
    const deleted = await supabase.from("photos").delete().eq("id", row.id);
    if (deleted.error) throw deleted.error;
    console.log(`deleted ${row.path_prefix}`);
  }
}
