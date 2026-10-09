// Turns the committed snapshots in scripts/seed/raw/ plus overrides.json into
// supabase/seed.sql: idempotent upserts for public.buildings and public.spaces.
//
//   node scripts/seed/build.mjs
//
// Sources and precedence:
// - Buildings: mguide.app's 466 records are the base (they carry the slugs every
//   space references, plus footprints). The official U-M apibuilder record for
//   the same building, matched by slug or by official building id, wins for
//   address, website, acronym, ramp and elevator access.
// - Spaces: the U-M Library's 34 "Find a Study Space" records, then mguide.app's
//   24 curated spaces. mguide spaces in buildings the Library covers are kept
//   but unlisted (overrides.json).
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "supabase", "seed.sql");
const LIBRARY_ORIGIN = "https://www.lib.umich.edu";

const readJson = async (name) =>
  JSON.parse(await readFile(join(HERE, name), "utf8"));

const meta = await readJson("raw/mguide-buildings-meta.json");
const footprints = await readJson("raw/mguide-buildings-map.geojson");
const official = (await readJson("raw/umich-buildings.json")).pois;
const library = (await readJson("raw/umich-library-fass.json")).spaces;
const mguideSpaces = await readJson("raw/mguide-study-spots.json");
const overrides = await readJson("overrides.json");

// ---------------------------------------------------------------- helpers

const clean = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
};

const officialId = (value) => {
  const id = clean(value);
  return id && id !== "0" ? id : null;
};

const number = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n)
    ? null
    : n;
};

const sql = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const jsonb = (value) => (value === null ? "null" : `${sql(JSON.stringify(value))}::jsonb`);

const features = (list) =>
  `${sql(`{${[...new Set(list)].sort().join(",")}}`)}::public.space_feature[]`;

const parseFloor = (label) => {
  if (!label) return null;
  if (/basement/i.test(label)) return 0;
  const match = label.match(/(?:floors?\s*)?(\d+)(?:st|nd|rd|th)?(?:\s*floor)?/i);
  return match ? Number(match[1]) : null;
};

// ---------------------------------------------------------------- buildings

const officialBySlug = new Map(official.map((poi) => [poi.slug, poi.input]));
const officialById = new Map(
  official
    .filter((poi) => officialId(poi.input.officalbuildingid))
    .map((poi) => [officialId(poi.input.officalbuildingid), poi.input]),
);

// Merge every polygon feature per slug into one MultiPolygon; points are
// dropped (they're markers, not footprints).
const polygonsBySlug = new Map();
for (const feature of footprints.features) {
  const { type, coordinates } = feature.geometry ?? {};
  const slug = feature.properties?.slug;
  if (!slug || (type !== "Polygon" && type !== "MultiPolygon")) continue;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  polygonsBySlug.set(slug, [...(polygonsBySlug.get(slug) ?? []), ...polygons]);
}

const footprintFor = (slug) => {
  const polygons = polygonsBySlug.get(slug);
  if (!polygons) return null;
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
};

const EXTRA_KEYS = [
  "buildingRecordNumber",
  "buildingPhase",
  "buildingType",
  "ownership",
  "classroomCount",
  "history",
  "children",
  "parentSlug",
  "groupLabel",
  "isComplex",
  "childSlugs",
  "wheelchairAccessible",
  "status",
  "tags",
  "wikipedia",
  "wikidataId",
];

const buildings = meta.map((b) => {
  const off =
    officialBySlug.get(b.slug) ??
    officialById.get(officialId(b.buildingRecordNumber)) ??
    null;
  const extra = {};
  for (const key of EXTRA_KEYS) {
    if (b[key] !== undefined && b[key] !== null) extra[key] = b[key];
  }
  const floors = number(b.floors);
  return {
    slug: b.slug,
    name: clean(b.name),
    short_name: clean(b.preferredName),
    acronym: clean(off?.acronym) ?? clean(b.displayAcronym ?? b.acronym),
    official_id: officialId(off?.officalbuildingid) ?? officialId(b.buildingRecordNumber),
    address: clean(off?.address) ?? clean(b.address),
    category: clean(b.category),
    campus: clean(b.campus),
    lat: number(b.lat),
    lng: number(b.lng),
    footprint: footprintFor(b.slug),
    floors: floors && floors > 0 ? floors : null,
    website: clean(off?.website) ?? clean(b.website),
    ramp_access: clean(off?.rampaccess) ?? clean(b.rampAccess),
    elevator_access: clean(off?.elevatoraccess) ?? clean(b.elevatorAccess),
    extra,
  };
});

// official_id is unique in the table, but mguide repeats a record number across
// the parts of one complex. Keep it only where it's unambiguous; the raw number
// stays in extra.buildingRecordNumber.
const idCounts = new Map();
for (const b of buildings) {
  if (b.official_id) idCounts.set(b.official_id, (idCounts.get(b.official_id) ?? 0) + 1);
}
for (const b of buildings) {
  if (b.official_id && idCounts.get(b.official_id) > 1) b.official_id = null;
}

const buildingSlugs = new Set(buildings.map((b) => b.slug));

// ---------------------------------------------------------------- spaces

const NOISE = new Set(["quiet", "low_noise", "conversational", "loud"]);
const FEATURES = new Set([
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
]);

const fail = (message) => {
  throw new Error(message);
};

const librarySpaces = library.map((s) => {
  const buildingSlug =
    overrides.libraryBuildings[s.building] ??
    fail(`No building mapping for Library building "${s.building}"`);
  const floorLabel = s.title.match(/\b(Basement|Floors? \d+(?: and \d+)?)\b/)?.[1] ?? null;
  const noise = NOISE.has(s.noiseLevel) ? s.noiseLevel : null;
  const spaceFeatures = (s.spaceFeatures ?? []).filter((f) => FEATURES.has(f));
  return {
    slug: s.slug.split("/").filter(Boolean).pop(),
    building_slug: buildingSlug,
    name: clean(s.title),
    summary: clean(s.bodySummary),
    floor: parseFloor(floorLabel),
    floor_label: floorLabel,
    noise_level: noise,
    features: spaceFeatures,
    capacity: null,
    image_url: s.imageUrl ? new URL(s.imageUrl, LIBRARY_ORIGIN).href : null,
    image_alt: s.imageUrl ? clean(s.imageAlt) : null,
    source: "um_library",
    source_url: new URL(s.slug, LIBRARY_ORIGIN).href,
    waitz_id: null,
    is_listed: true,
  };
});

const unlisted = new Set(overrides.unlistedMguideSpaces);
const mguideRows = mguideSpaces.map((s) => ({
  slug: s.slug,
  building_slug: s.buildingSlug,
  name: clean(s.name),
  summary: null,
  floor: parseFloor(s.floor),
  floor_label: clean(s.floor),
  noise_level:
    overrides.mguideNoise[s.noiseLevel] ?? fail(`No noise mapping for "${s.noiseLevel}"`),
  features: (s.amenities ?? [])
    .map((a) => overrides.mguideAmenities[a])
    .filter(Boolean),
  capacity: number(s.capacity) > 0 ? number(s.capacity) : null,
  image_url: null,
  image_alt: null,
  source: "mguide",
  source_url: null,
  waitz_id: clean(s.waitzId),
  is_listed: !unlisted.has(s.slug),
}));

const spaces = [...librarySpaces, ...mguideRows];

const seen = new Set();
for (const s of spaces) {
  if (seen.has(s.slug)) fail(`Duplicate space slug ${s.slug}`);
  seen.add(s.slug);
  if (!buildingSlugs.has(s.building_slug)) {
    fail(`Space ${s.slug} references unknown building ${s.building_slug}`);
  }
}
for (const slug of unlisted) {
  if (!mguideSpaces.some((s) => s.slug === slug)) fail(`Unknown unlisted slug ${slug}`);
}

// ---------------------------------------------------------------- SQL

const BUILDING_COLUMNS = [
  "slug", "name", "short_name", "acronym", "official_id", "address", "category",
  "campus", "lat", "lng", "footprint", "floors", "website", "ramp_access",
  "elevator_access", "extra",
];
const SPACE_COLUMNS = [
  "slug", "building_slug", "name", "summary", "floor", "floor_label",
  "noise_level", "features", "capacity", "image_url", "image_alt", "source",
  "source_url", "waitz_id", "is_listed",
];

const buildingValues = (b) =>
  BUILDING_COLUMNS.map((c) =>
    c === "footprint" || c === "extra" ? jsonb(b[c]) : sql(b[c]),
  ).join(", ");

const spaceValues = (s) =>
  SPACE_COLUMNS.map((c) => {
    if (c === "features") return features(s.features);
    if (c === "noise_level") return s.noise_level ? `${sql(s.noise_level)}::public.noise_level` : "null";
    if (c === "source") return `${sql(s.source)}::public.space_source`;
    return sql(s[c]);
  }).join(", ");

const upsert = (table, columns, rows, values, key) =>
  [
    `insert into public.${table} (${columns.join(", ")})`,
    "values",
    rows.map((r) => `  (${values(r)})`).join(",\n"),
    `on conflict (${key}) do update set`,
    columns
      .filter((c) => c !== key)
      .map((c) => `  ${c} = excluded.${c}`)
      .join(",\n") + ";",
  ].join("\n");

const listedCount = spaces.filter((s) => s.is_listed).length;
const header = `-- Generated by scripts/seed/build.mjs from scripts/seed/raw/ (see
-- raw/SOURCES.md for where and when each snapshot was fetched). Don't edit by
-- hand: change overrides.json or re-fetch, then rebuild.
--
-- ${buildings.length} buildings (${buildings.filter((b) => b.footprint).length} with footprints), ${spaces.length} spaces (${listedCount} listed).
-- Idempotent: safe to run again against a database that already has the rows.
`;

await writeFile(
  OUT,
  [
    header,
    "begin;",
    "",
    upsert("buildings", BUILDING_COLUMNS, buildings, buildingValues, "slug"),
    "",
    upsert("spaces", SPACE_COLUMNS, spaces, spaceValues, "slug"),
    "",
    "commit;",
    "",
  ].join("\n"),
);

console.log(
  `Wrote ${OUT}: ${buildings.length} buildings, ${spaces.length} spaces (${listedCount} listed)`,
);
