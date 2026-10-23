// Turns the committed snapshots in scripts/seed/raw/ plus overrides.json into
// supabase/seed.sql: idempotent upserts for public.buildings, public.spaces and
// the tables that hang off them.
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
// - Bookable items: every LibCal room and seat from the three instances'
//   location pages, with room number and floor parsed from the title.
// - Building entrances: every exterior door on the U-M Facilities campus map
//   (scripts/campus-map/raw/), linked to a building by record number.
// - Classrooms: MClassrooms' general-purpose classrooms (mclassrooms.json,
//   exported by hand), each already matched to a building.
// - Printers: MPrint's public printers (mprint-printers.json, exported by
//   hand), linked to a building by record number.
// - Google places: the Google Maps place saved for each building by
//   scripts/serpapi/fetch.mjs, plus its hours for buildings the Library
//   doesn't cover and its popular times when Google has them.
import { readdir, readFile, writeFile } from "node:fs/promises";
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
const libcalPages = await readJson("raw/libcal-items.json");
const libraryCms = await readJson("raw/umich-library-cms.json");
const librarySpacePages = await readJson("raw/umich-library-space-pages.json");
const foAccessibility = await readJson("../campus-map/raw/accessibility.json");
const foBuildings = await readJson("../../public/campus-map/9-buildings.geojson");
// Periods that ended before the snapshot was taken are dropped. Using the
// snapshot date, not today, keeps the output reproducible for the CI check.
const snapshotDate = (await readFile(join(HERE, "raw", "SOURCES.md"), "utf8")).match(
  /Fetched (\d{4}-\d{2}-\d{2})/,
)[1];
const overrides = await readJson("overrides.json");
const googlePlaces = await Promise.all(
  (await readdir(join(HERE, "..", "serpapi", "raw", "places")))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => readJson(`../serpapi/raw/places/${name}`)),
);

// ---------------------------------------------------------------- helpers

const clean = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
};

// U-M building record numbers are seven digits; the apibuilder data uses "0"
// for none and "1" for Angell Hall.
const officialId = (value) => {
  const id = clean(value);
  return id && /^\d{7}$/.test(id) ? id : null;
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
for (const [slug, id] of Object.entries(overrides.officialIds)) {
  const b = buildings.find((x) => x.slug === slug) ?? fail(`Unknown building ${slug} in officialIds`);
  if (id !== null && buildings.some((x) => x.official_id === id && x.slug !== slug)) {
    fail(`officialIds gives ${id} to ${slug}, but another building has it`);
  }
  b.official_id = id;
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

// "About the space" from each Library space page, as plain text: paragraphs
// separated by blank lines, list items as "- ". The page's trailing "Other
// study spaces on floor N" section is dropped; it's about other spaces.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const htmlText = (html) =>
  html
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/(p|ul|ol|h\d)>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const descriptionBySlug = new Map(
  librarySpacePages.map((page) => {
    const prose = page.main?.match(/<div class="prose ?"[^>]*>([\s\S]*?)<\/div>\s*<div class="find-another-link"/)?.[1];
    const about = prose?.split(/<h2[\s>]/)[0];
    return [page.slug, about ? htmlText(about) || null : null];
  }),
);

const librarySpaces = library.map((s) => {
  const buildingSlug =
    overrides.libraryBuildings[s.building] ??
    fail(`No building mapping for Library building "${s.building}"`);
  const floorLabel = s.title.match(/\b(Basement|Floors? \d+(?: and \d+)?)\b/)?.[1] ?? null;
  const noise = NOISE.has(s.noiseLevel) ? s.noiseLevel : null;
  const spaceFeatures = (s.spaceFeatures ?? []).filter((f) => FEATURES.has(f));
  const slug = s.slug.split("/").filter(Boolean).pop();
  if (floorLabel && slug in overrides.spaceFloors) fail(`spaceFloors: ${slug} already has a floor in its title`);
  return {
    slug,
    building_slug: buildingSlug,
    name: clean(s.title),
    summary: clean(s.bodySummary),
    description: descriptionBySlug.get(s.slug) ?? null,
    floor: parseFloor(floorLabel) ?? overrides.spaceFloors[slug] ?? null,
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
  description: null,
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
const listedSpaceSlugs = new Set(spaces.filter((s) => s.is_listed).map((s) => s.slug));
for (const slug of [...Object.keys(overrides.spaceFloors), ...Object.keys(overrides.spaceRooms)]) {
  if (!librarySpaces.some((s) => s.slug === slug)) fail(`Unknown Library space ${slug} in overrides`);
}

// ---------------------------------------------------------------- bookable items

// Room number and floor from a LibCal title. The formats differ per location:
//   "2nd Floor - 2122 - Study Room (Capacity 5)"   Shapiro
//   "Carrel 3-01 (3001) (Capacity 1)"               Hatcher carrel, room 3001
//   "4S - 50", "6S - 600"                           Hatcher donor carrel, room 4050 or 600
//   "Hatcher 212A", "DC 2344", "GGBL 2502 - ...",   building code + room
//   "NCRC 028-G129 Seat 06", "2407 Mason Hall", "1133B"
const libcalPlace = (title) => {
  const text = title.replace(/\s*\(Capacity \d+\)\s*$/, "");
  const floorFrom = (room) => {
    const m = room?.match(/^(\d)\d{2,3}[A-Z]?$/);
    return m ? Number(m[1]) : null;
  };
  let m = text.match(/^(\d)(?:st|nd|rd|th) Floor - (\S+)/);
  if (m) return { floor: Number(m[1]), room_number: /^\d/.test(m[2]) ? m[2] : null };
  m = text.match(/^Carrel (\d)-\d+ \((\d{4})\)$/);
  if (m) return { floor: Number(m[1]), room_number: m[2] };
  // The floor sheets print donor carrels as plain numbers: "4S - 49" is 4049 and
  // "6S - 600" (the corner room) is 600. Read off the sheets, not from the Library.
  m = text.match(/^(\d)S - (\d+)$/);
  if (m) return { floor: Number(m[1]), room_number: m[2].length > 2 ? m[2] : `${m[1]}0${m[2].padStart(2, "0")}` };
  m = text.match(/^Carrel (\d)-/);
  if (m) return { floor: Number(m[1]), room_number: null };
  m = text.match(/^NCRC \d+-(G?\d+)\b/);
  if (m) return { floor: m[1].startsWith("G") ? 0 : floorFrom(m[1]), room_number: m[1] };
  m =
    text.match(/^(?:Hatcher|DC|LBME|BBB|GGBL|FMCRB|CSRB) (\d{3,4}[A-Z]?)\b/) ??
    text.match(/^(\d{4}[A-Z]?)(?: Mason Hall)?$/);
  if (m) return { floor: floorFrom(m[1]), room_number: m[1] };
  return { floor: null, room_number: null };
};

// Page titles read "Space Availability - Shapiro Undergraduate Library - LibCal
// - ...". Some pages only carry the instance name; those give no location.
const locationName = (title) => {
  const parts = (title ?? "").split(" - ").map(clean);
  const name = parts[1];
  return name && !/^(?:LibCal|North Campus|Central Campus)$/.test(name) ? name : null;
};
const locationByLid = new Map();
for (const page of libcalPages) {
  const name = locationName(page.location);
  if (name) locationByLid.set(`${page.instance}/${page.lid}`, name);
}

const unlistedGroupings = new Set(overrides.unlistedLibcalGroupings);
const libcalSpaceUsed = new Set();
const libcalSpace = (lid, grouping, title) => {
  const rule = overrides.libcalSpaces.find(
    (r) => r.lid === String(lid) && r.grouping === grouping && (!r.title || new RegExp(r.title).test(title)),
  );
  if (!rule) return null;
  libcalSpaceUsed.add(rule);
  return rule.space;
};
const bookableByKey = new Map();
for (const page of libcalPages) {
  for (const item of page.items) {
    if (item.unparsed) fail(`Unparsed LibCal item on ${page.url}: ${item.error}`);
    const kind = item.url.split("/")[1];
    const id = Number(item.url.split("/")[2]);
    const key = `${page.instance}/${id}`;
    const buildingSlug =
      overrides.libcalBuildings[item.lid] ??
      fail(`No building mapping for LibCal lid ${item.lid} (${item.title})`);
    const grouping = clean(item.grouping);
    bookableByKey.set(key, {
      instance: page.instance,
      libcal_item_id: id,
      lid: item.lid,
      kind,
      title: clean(item.title),
      location_name: locationByLid.get(`${page.instance}/${item.lid}`) ?? null,
      grouping,
      building_slug: buildingSlug,
      space_slug: libcalSpace(item.lid, grouping, item.title),
      ...libcalPlace(item.title),
      capacity: number(item.capacity) > 0 ? number(item.capacity) : null,
      booking_url: `https://${page.instance}${item.url}`,
      thumbnail_url: clean(item.thumbnail),
      is_listed: !unlistedGroupings.has(grouping),
    });
  }
}
const bookableItems = [...bookableByKey.values()].sort(
  (a, b) => a.instance.localeCompare(b.instance) || a.libcal_item_id - b.libcal_item_id,
);
for (const item of bookableItems) {
  if (item.kind !== "space" && item.kind !== "seat") fail(`Unknown LibCal kind ${item.kind}`);
  if (!buildingSlugs.has(item.building_slug)) {
    fail(`LibCal item ${item.title} references unknown building ${item.building_slug}`);
  }
}
for (const grouping of unlistedGroupings) {
  if (!bookableItems.some((item) => item.grouping === grouping)) {
    fail(`Unknown unlisted LibCal grouping ${grouping}`);
  }
}
for (const rule of overrides.libcalSpaces) {
  if (!libcalSpaceUsed.has(rule)) fail(`libcalSpaces rule matches no item: ${JSON.stringify(rule)}`);
  if (!listedSpaceSlugs.has(rule.space)) fail(`libcalSpaces: ${rule.space} isn't a listed space`);
}
for (const item of bookableItems) {
  const space = item.space_slug && spaces.find((s) => s.slug === item.space_slug);
  if (space && space.building_slug !== item.building_slug) {
    fail(`LibCal item ${item.title} is in ${item.building_slug}, its space ${space.slug} in ${space.building_slug}`);
  }
}

// ---------------------------------------------------------------- space locations

// The rooms each space is in: its LibCal items' rooms, or its spaceRooms when it
// has them (they win where a LibCal room isn't drawn on the plan). Open areas
// need an outline drawn in /admin/spaces, so they aren't seeded.
const spaceLocationKeys = new Set();
const spaceLocations = [
  ...bookableItems
    .filter((item) => item.space_slug && item.room_number && item.floor !== null)
    .filter((item) => !(item.space_slug in overrides.spaceRooms))
    .map((item) => ({ space_slug: item.space_slug, floor: item.floor, room_number: item.room_number })),
  ...Object.entries(overrides.spaceRooms).flatMap(([slug, rooms]) =>
    rooms.map((r) => ({ space_slug: slug, floor: r.floor, room_number: r.room })),
  ),
]
  .filter((l) => {
    const key = `${l.space_slug}/${l.floor}/${l.room_number}`;
    if (spaceLocationKeys.has(key)) return false;
    spaceLocationKeys.add(key);
    return true;
  })
  .sort(
    (a, b) =>
      a.space_slug.localeCompare(b.space_slug) || a.floor - b.floor || a.room_number.localeCompare(b.room_number),
  );

// ---------------------------------------------------------------- opening hours

// The Library CMS stores hours as periods (field_date_range) with one entry per
// weekday: start/end as HHMM integers, or a comment such as "24 hours",
// "Opens at 10am", "Closes at 6pm" or "Closed". "Opens at" and "Closes at" are
// the edges of a stretch of 24-hour days, so they run to or from midnight.
const hhmm = (n) => `${String(Math.floor(n / 100)).padStart(2, "0")}:${String(n % 100).padStart(2, "0")}`;
const clock = (text, fallbackMeridiem) => {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i) ?? fail(`Unreadable time "${text}"`);
  let hour = Number(m[1]) % 12;
  const meridiem = (m[3] ?? fallbackMeridiem)?.toLowerCase() ?? fail(`No am/pm in "${text}"`);
  if (meridiem === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${m[2] ?? "00"}`;
};

const libraryDay = (entry) => {
  const comment = (entry.comment ?? "").trim().toLowerCase();
  if (/^closed|^virtual only$|^by appointment$/.test(comment)) return [];
  if (comment === "24 hours" || comment === "open 24 hours") return [{ opens: "00:00", closes: "24:00" }];
  let m = comment.match(/^opens at (.+)$/);
  if (m) return [{ opens: clock(m[1]), closes: "24:00" }];
  m = comment.match(/^closes at (.+)$/);
  if (m) {
    const closes = clock(m[1]);
    return [{ opens: "00:00", closes: closes === "00:00" ? "24:00" : closes }];
  }
  if (comment) {
    // e.g. "11am - 1pm, 2 - 6pm"
    return comment.split(",").map((range) => {
      const [from, to] = range.split("-").map((part) => part.trim());
      if (!to) fail(`Unreadable Library hours comment "${entry.comment}"`);
      const meridiem = to.match(/(am|pm)$/)?.[1];
      return { opens: clock(from, meridiem), closes: clock(to) };
    });
  }
  if (entry.all_day) return [{ opens: "00:00", closes: "24:00" }];
  if (entry.starthours == null || entry.endhours == null) fail(`Library hours entry without times: ${JSON.stringify(entry)}`);
  return [{ opens: hhmm(entry.starthours), closes: hhmm(entry.endhours) }];
};

const cmsHours = new Map(
  [...libraryCms.buildings.hours, ...libraryCms.locations.hours].map((p) => [p.id, p]),
);
const cmsBuildingByTitle = new Map(libraryCms.buildings.places.map((b) => [b.title, b]));
const PERIOD_LABEL = (type) =>
  type
    .replace(/^paragraph--/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

const libraryHoursRows = (title, subject) => {
  const building = cmsBuildingByTitle.get(title) ?? fail(`No Library CMS building "${title}"`);
  const rows = [];
  for (const id of building.hours) {
    const period = cmsHours.get(id);
    const range = period?.field_date_range;
    if (!range?.value || !range.end_value || range.end_value < snapshotDate) continue;
    for (const entry of period.field_hours_open ?? []) {
      const intervals = libraryDay(entry);
      const base = {
        ...subject,
        label: PERIOD_LABEL(period.type),
        valid_from: range.value,
        valid_until: range.end_value,
        weekday: entry.day,
        access: "public",
        source: "um_library",
        source_url: `${LIBRARY_ORIGIN}${building.path ?? ""}`,
      };
      if (!intervals.length) rows.push({ ...base, opens: null, closes: null });
      for (const interval of intervals) rows.push({ ...base, ...interval });
    }
  }
  return rows;
};

const openingHours = [
  ...library.map((s) =>
    libraryHoursRows(s.building, { building_slug: null, space_slug: s.slug.split("/").filter(Boolean).pop() }),
  ),
  ...Object.entries(overrides.libraryHoursBuildings).map(([title, slug]) =>
    libraryHoursRows(title, { building_slug: slug, space_slug: null }),
  ),
].flat();
for (const row of openingHours) {
  if (row.building_slug && !buildingSlugs.has(row.building_slug)) fail(`Hours for unknown building ${row.building_slug}`);
  if (row.opens !== null && row.opens === row.closes) fail(`Empty interval ${JSON.stringify(row)}`);
}

// ---------------------------------------------------------------- entrances

// FO rates each door in one field: Automatic, Manual (accessible), AutoNonAcc
// or ManNonAcc. Doors name a building by record number only; FO's building
// layer supplies a display name, and our buildings match on official_id or
// mguide's buildingRecordNumber. mguide repeats a record number across a few
// sub-buildings, so a door goes to the nearest of those.
const DOOR_RATING = {
  Automatic: { accessible: true, automatic: true },
  Manual: { accessible: true, automatic: false },
  AutoNonAcc: { accessible: false, automatic: true },
  ManNonAcc: { accessible: false, automatic: false },
};
const foBuildingName = new Map(
  foBuildings.features.map((f) => [f.properties.loc_ObjectNum, clean(f.properties.Label) ?? clean(f.properties.ObjectName)]),
);
const buildingsByRecord = new Map();
for (const b of buildings) {
  for (const id of new Set([b.official_id, officialId(b.extra.buildingRecordNumber)].filter(Boolean))) {
    buildingsByRecord.set(id, [...(buildingsByRecord.get(id) ?? []), b]);
  }
}
const nearest = (candidates, lat, lng) =>
  candidates.reduce((best, b) =>
    (b.lat - lat) ** 2 + (b.lng - lng) ** 2 < (best.lat - lat) ** 2 + (best.lng - lng) ** 2 ? b : best,
  );
const entrances = foAccessibility.doors
  .map((door) => {
    const p = door.properties;
    const rating = DOOR_RATING[p.Accessible] ?? fail(`Unknown door rating ${p.Accessible} on ${p.OBJECTID}`);
    const [lng, lat] = door.geometry.coordinates;
    const record = officialId(p.BldRecNbr);
    const candidates = (buildingsByRecord.get(record) ?? []).filter((b) => b.lat !== null);
    return {
      id: p.GlobalID.replace(/[{}]/g, "").toLowerCase(),
      fo_object_id: p.OBJECTID,
      building_record_number: record,
      building_name: foBuildingName.get(record) ?? null,
      building_slug: candidates.length ? nearest(candidates, lat, lng).slug : null,
      lat,
      lng,
      floor_label: clean(p.Floor),
      ...rating,
      keypad: p.Keypad === 1,
      location_description: clean(p.AltText),
      notes: clean(p.Comments),
    };
  })
  .sort((a, b) => a.fo_object_id - b.fo_object_id);
const linkedEntrances = entrances.filter((e) => e.building_slug).length;

// ---------------------------------------------------------------- Google places

// Place results list attributes as one-key objects per category
// ([{ "accessibility": [...] }, ...]); the table keeps one object.
const byCategory = (list) => Object.assign({}, ...(list ?? []));
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const GOOGLE_HOURS_DAYS = 120;
const addDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

// Google writes a day as "Open 24 hours", "Closed" or comma-separated
// intervals with an en dash, giving AM/PM on the end time only when both ends
// share it ("1–5 PM", but "11 AM–1 PM").
const googleDay = (text) => {
  const day = text.replace(/\s+/g, " ").trim();
  if (/^closed$/i.test(day)) return [];
  if (/^open 24 hours$/i.test(day)) return [{ opens: "00:00", closes: "24:00" }];
  return day.split(",").map((range) => {
    const [from, to] = range.split(/[–-]/).map((part) => part.trim());
    if (!to) fail(`Unreadable Google hours "${text}"`);
    const closes = clock(to);
    const meridiem = to.match(/(am|pm)$/i)?.[1];
    let opens = clock(from, meridiem);
    // "11–1 PM" is 11 AM to 1 PM.
    if (!/(am|pm)$/i.test(from) && opens > closes && meridiem?.toLowerCase() === "pm") opens = clock(from, "am");
    return { opens, closes };
  });
};

const libraryHourBuildings = new Set(Object.values(overrides.libraryHoursBuildings));
const googleRows = [];
const googleHours = [];
const popularTimes = [];
for (const saved of googlePlaces) {
  const p = saved.place;
  if (!buildingSlugs.has(saved.slug)) fail(`Google place for unknown building ${saved.slug}`);
  if (saved.distance_from_ours_m > 300) fail(`Google place for ${saved.slug} is ${saved.distance_from_ours_m} m away`);
  const fetchedAt = saved.fetched_at;
  googleRows.push({
    building_slug: saved.slug,
    place_id: p.place_id,
    data_id: p.data_id ?? null,
    data_cid: p.data_cid ?? null,
    name: p.title,
    address: p.address ?? null,
    lat: p.gps_coordinates?.latitude ?? null,
    lng: p.gps_coordinates?.longitude ?? null,
    types: [p.type ?? []].flat(),
    rating: number(p.rating),
    review_count: number(p.reviews),
    website: p.website ?? null,
    phone: p.phone ?? null,
    located_in: p.located_in ?? null,
    typical_time_spent: p.popular_times?.live_hash?.time_spent ?? null,
    hours_last_updated: p.hours_last_updated ?? null,
    extensions: byCategory(p.extensions),
    unsupported_extensions: byCategory(p.unsupported_extensions),
    review_topics: (p.user_reviews?.topics ?? []).map((t) => ({ keyword: t.keyword, mentions: t.mentions })),
    fetched_at: fetchedAt,
  });

  // Google's hours are its current regular week with no end date, so they
  // count for GOOGLE_HOURS_DAYS from the fetch and then lapse until refetched.
  // The Library's own hours win for its buildings.
  if (!libraryHourBuildings.has(saved.slug)) {
    for (const entry of p.hours ?? []) {
      const [[name, text]] = Object.entries(entry);
      const weekday = WEEKDAYS.indexOf(name.toLowerCase());
      if (weekday < 0) fail(`Unknown weekday "${name}" in Google hours for ${saved.slug}`);
      const base = {
        space_slug: null,
        building_slug: saved.slug,
        label: "Regular hours (Google Maps)",
        valid_from: fetchedAt.slice(0, 10),
        valid_until: addDays(fetchedAt, GOOGLE_HOURS_DAYS),
        weekday,
        access: "public",
        source: "google",
        source_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      };
      const intervals = googleDay(text);
      if (!intervals.length) googleHours.push({ ...base, opens: null, closes: null });
      for (const interval of intervals) googleHours.push({ ...base, ...interval });
    }
  }

  // graph_results: { sunday: [{ time: "6 AM", busyness_score: 12 }, ...], ... }
  for (const [name, hours] of Object.entries(p.popular_times?.graph_results ?? {})) {
    const weekday = WEEKDAYS.indexOf(name.toLowerCase());
    if (weekday < 0) fail(`Unknown weekday "${name}" in popular times for ${saved.slug}`);
    for (const h of hours) {
      if (typeof h.busyness_score !== "number") continue;
      popularTimes.push({
        building_slug: saved.slug,
        weekday,
        hour: Number(clock(h.time).slice(0, 2)),
        busyness: h.busyness_score,
        fetched_at: fetchedAt,
      });
    }
  }
}
// Hand-copied curves fill in buildings SerpApi returned none for.
const manualPopularTimes = await readJson("manual-popular-times.json");
for (const [slug, entry] of Object.entries(manualPopularTimes)) {
  if (slug.startsWith("_")) continue;
  if (!buildingSlugs.has(slug)) fail(`Manual popular times for unknown building ${slug}`);
  if (popularTimes.some((row) => row.building_slug === slug)) continue;
  for (const [weekday, hours] of Object.entries(entry.weekdays)) {
    for (const [hour, busyness] of hours) {
      popularTimes.push({ building_slug: slug, weekday: Number(weekday), hour, busyness, fetched_at: entry.fetched_at });
    }
  }
}
for (const row of googleHours) {
  if (row.opens !== null && row.opens === row.closes) fail(`Empty interval ${JSON.stringify(row)}`);
}

// ---------------------------------------------------------------- classrooms

// mguide's room-schedules.json: the Registrar's class meetings per room for
// the current term, keyed "BUILDINGCODE-ROOM". Codes match buildings.acronym
// except the ones in overrides.classroomBuildings.
const roomSchedules = await readJson("raw/mguide-room-schedules.json");
const buildingsByAcronym = new Map();
for (const b of buildings) {
  if (!b.acronym) continue;
  const key = b.acronym.toUpperCase();
  buildingsByAcronym.set(key, buildingsByAcronym.has(key) ? null : b.slug);
}
for (const slug of Object.values(overrides.classroomBuildings)) {
  if (slug !== null && !buildingSlugs.has(slug)) fail(`Unknown classroom building ${slug}`);
}
const classroomBuilding = (code, room) => {
  for (const key of [`${code}-${room[0]}`, code]) {
    if (key in overrides.classroomBuildings) return overrides.classroomBuildings[key];
  }
  return buildingsByAcronym.get(code.toUpperCase()) ?? null;
};
const WEEKDAY = { SU: 0, M: 1, T: 2, W: 3, TH: 4, F: 5, S: 6 };
const classDays = (days) => {
  const tokens = days.match(/TH|SU|M|T|W|F|S/g) ?? [];
  if (tokens.join("") !== days) fail(`Unknown class days ${days}`);
  return [...new Set(tokens.map((t) => WEEKDAY[t]))].sort((a, b) => a - b);
};
const classClock = (text) => {
  const match = text.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/) ?? fail(`Unknown class time ${text}`);
  const hour = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
};
const classroomMeetings = [];
let skippedMeetings = 0;
for (const [roomCode, meetings] of Object.entries(roomSchedules)) {
  const dash = roomCode.indexOf("-");
  if (dash < 1) fail(`Unexpected room code ${roomCode}`);
  const buildingCode = roomCode.slice(0, dash);
  const roomNumber = roomCode.slice(dash + 1);
  const buildingSlug = classroomBuilding(buildingCode, roomNumber);
  for (const m of meetings) {
    // A few placeholder sections start and end at the same minute; skip them.
    if (classClock(m.end) <= classClock(m.start)) {
      skippedMeetings += 1;
      continue;
    }
    classroomMeetings.push({
      room_code: roomCode,
      building_code: buildingCode,
      room_number: roomNumber,
      building_slug: buildingSlug,
      course: clean(m.course),
      section: clean(m.section),
      title: clean(m.title),
      cross_listed: (m.crossListed ?? []).map(clean).filter(Boolean),
      weekdays: classDays(m.days),
      starts: classClock(m.start),
      ends: classClock(m.end),
      first_day: m.startDate,
      last_day: m.endDate,
    });
  }
}
classroomMeetings.sort(
  (a, b) =>
    a.room_code.localeCompare(b.room_code) ||
    a.weekdays[0] - b.weekdays[0] ||
    a.starts.localeCompare(b.starts) ||
    a.course.localeCompare(b.course) ||
    a.section.localeCompare(b.section),
);
const classroomRooms = new Set(classroomMeetings.map((m) => m.room_code)).size;
const linkedClassroomRooms = new Set(
  classroomMeetings.filter((m) => m.building_slug).map((m) => m.room_code),
).size;

// ---------------------------------------------------------------- MClassrooms

// LSA Technology Services' MClassrooms (mclassrooms.umich.edu), exported from
// the logged-in site into mclassrooms.json: general-purpose classrooms with
// seats, characteristics, office contacts, photos and panoramas. Each room
// already carries its building_slug and how it was matched. A room's features
// are the exact space_feature mappings of its characteristics.
const mclassrooms = await readJson("mclassrooms.json");
const characteristicRows = mclassrooms.vocabulary.characteristics
  .map((c) => ({
    value: c.value,
    category: clean(c.category),
    label: clean(c.label),
    page_label: clean(c.page_label),
    description: clean(c.description),
    glossary_anchor: clean(c.glossary_anchor),
    space_feature: c.space_feature ?? null,
    feature_match: c.feature_match ?? null,
  }))
  .sort((a, b) => a.value.localeCompare(b.value));
const exactFeature = new Map(
  characteristicRows.filter((c) => c.feature_match === "exact").map((c) => [c.value, c.space_feature]),
);
const knownCharacteristics = new Set(characteristicRows.map((c) => c.value));
const classrooms = mclassrooms.rooms
  .map((r) => {
    if (r.building_slug && !buildingSlugs.has(r.building_slug)) {
      fail(`Unknown building ${r.building_slug} on classroom ${r.room_code}`);
    }
    const values = r.characteristics.map((c) =>
      knownCharacteristics.has(c.value) ? c.value : fail(`Unknown characteristic ${c.value} on ${r.room_code}`),
    );
    return {
      mclassrooms_id: r.mclassrooms_id,
      room_code: r.room_code,
      building_slug: r.building_slug ?? null,
      building_match: r.building_match ?? null,
      building_official_id: r.building_official_id,
      building_name: clean(r.building_name),
      building_code: clean(r.building_code),
      room_number: clean(r.room_number),
      floor_label: clean(r.floor),
      address: clean(r.address),
      school_or_college: clean(r.school_or_college),
      seats: number(r.seats),
      characteristics: [...new Set(values)].sort(),
      features: [...new Set(values.map((v) => exactFeature.get(v)).filter(Boolean))].sort(),
      scheduling_contact: r.scheduling_contact ?? null,
      support_contact: r.support_contact ?? null,
      notes: clean(r.notes),
      notes_updated_on: r.notes_updated_on ?? null,
      page_url: r.page_url,
      schedule_url: r.schedule_url ?? null,
      floor_map_url: r.floor_map_url ?? null,
      layout_pdf_url: r.layout_pdf_url ?? null,
      panorama_url: r.panorama_url ?? null,
      photos: r.photos ?? [],
      fetched_on: mclassrooms.fetched_at,
    };
  })
  .sort((a, b) => a.mclassrooms_id - b.mclassrooms_id);
const linkedClassrooms = classrooms.filter((c) => c.building_slug).length;

// ---------------------------------------------------------------- printers

// MPrint's printer list, exported by hand (scripts/seed/mprint-printers.json).
// Disabled printers are members of a pooled queue (the pool is listed
// instead), non-public ones are staff-only, and the "Virtual Floor" entries
// are Follow Me queues with no place. Buildings match by record number like
// entrances do, except the ones in overrides.printerBuildings.
const mprint = await readJson("mprint-printers.json");
for (const slug of Object.values(overrides.printerBuildings)) {
  if (!buildingSlugs.has(slug)) fail(`Unknown printer building ${slug}`);
}
// One printer leaves the unit blank at the usual 9 cents; that's per page.
const PRICE_UNIT = { impression: "page", "": "page", foot: "foot" };
const printers = mprint.printers
  .filter((p) => p.enabled === 1 && p.public === 1 && !/virtual/i.test(p.floor_name ?? ""))
  .map((p) => {
    const record = officialId(p.building_record_number);
    const candidates = (buildingsByRecord.get(record) ?? []).filter((b) => b.lat !== null);
    const price = number(p.cost);
    return {
      mprint_name: p.name,
      display_name: clean(p.display_name),
      building_record_number: record,
      building_name: clean(p.building_name),
      building_slug:
        overrides.printerBuildings[record] ??
        (candidates.length ? nearest(candidates, p.building_lat, p.building_lng).slug : null),
      floor_label: clean(p.floor_name),
      floor: parseFloor(p.floor_name),
      room_number: clean(p.room)?.toUpperCase() ?? null,
      color: p.color === 1,
      tabloid: p.tabloid === 1,
      copier: p.copy === 1,
      poster: p.poster === 1,
      staple: p.staple === 1,
      card_reader: p.card_reader === 1,
      price,
      price_unit: price === null ? null : PRICE_UNIT[p.cost_unit ?? ""] ?? fail(`Unknown price unit ${p.cost_unit} on ${p.name}`),
      notes: clean(p.notes),
      floor_map: clean(p.floor_map),
      floor_map_x: number(p.floor_map_x),
      floor_map_y: number(p.floor_map_y),
    };
  })
  .sort((a, b) => a.mprint_name.localeCompare(b.mprint_name));
const linkedPrinters = printers.filter((p) => p.building_slug).length;

// ---------------------------------------------------------------- SQL

const BUILDING_COLUMNS = [
  "slug", "name", "short_name", "acronym", "official_id", "address", "category",
  "campus", "lat", "lng", "footprint", "floors", "website", "ramp_access",
  "elevator_access", "extra",
];
const SPACE_COLUMNS = [
  "slug", "building_slug", "name", "summary", "description", "floor", "floor_label",
  "noise_level", "features", "capacity", "image_url", "image_alt", "source",
  "source_url", "waitz_id", "is_listed",
];

const BOOKABLE_COLUMNS = [
  "instance", "libcal_item_id", "lid", "kind", "title", "location_name",
  "grouping", "building_slug", "floor", "room_number", "capacity", "booking_url",
  "thumbnail_url", "is_listed", "space_id",
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

const HOURS_COLUMNS = [
  "space_slug", "building_slug", "label", "valid_from", "valid_until", "weekday",
  "opens", "closes", "access", "source", "source_url",
];
const hoursValues = (row) => HOURS_COLUMNS.map((c) => sql(row[c])).join(", ");

// opening_hours rows have no natural key, so the Library's rows are replaced
// wholesale; rows from other sources are left alone.
const hoursSql = [
  "delete from public.opening_hours where source = 'um_library';",
  "insert into public.opening_hours (building_slug, space_id, label, valid_from, valid_until, weekday, opens, closes, access, source, source_url)",
  "select v.building_slug, s.id, v.label, v.valid_from::date, v.valid_until::date, v.weekday::smallint, v.opens::time, v.closes::time, v.access, v.source, v.source_url",
  `from (values\n${openingHours.map((r) => `  (${hoursValues(r)})`).join(",\n")}\n) as v (${HOURS_COLUMNS.join(", ")})`,
  "left join public.spaces s on s.slug = v.space_slug;",
].join("\n");

const ENTRANCE_COLUMNS = [
  "id", "fo_object_id", "building_record_number", "building_name", "building_slug",
  "lat", "lng", "floor_label", "accessible", "automatic", "keypad",
  "location_description", "notes",
];
// Doors FO removes should disappear too, so the campus map's rows are replaced
// wholesale; manual rows are left alone. Nothing references an entrance.
const entrancesSql = [
  "delete from public.building_entrances where source = 'fo_campus_map';",
  `insert into public.building_entrances (${ENTRANCE_COLUMNS.join(", ")})`,
  "values",
  entrances.map((e) => `  (${ENTRANCE_COLUMNS.map((c) => sql(e[c])).join(", ")})`).join(",\n") + ";",
].join("\n");

// Google rows are replaced wholesale too: a building whose place file is
// deleted loses its place, hours and popular times.
const GOOGLE_COLUMNS = [
  "building_slug", "place_id", "data_id", "data_cid", "name", "address", "lat", "lng",
  "types", "rating", "review_count", "website", "phone", "located_in",
  "typical_time_spent", "hours_last_updated", "extensions", "unsupported_extensions",
  "review_topics", "fetched_at",
];
const googleValue = (row, c) => {
  if (c === "types") return `${sql(`{${row.types.map((t) => `"${t.replace(/["\\]/g, "\\$&")}"`).join(",")}}`)}::text[]`;
  if (["extensions", "unsupported_extensions", "review_topics"].includes(c)) return jsonb(row[c]);
  return sql(row[c]);
};
const POPULAR_COLUMNS = ["building_slug", "weekday", "hour", "busyness", "fetched_at"];
const googleSql = [
  "delete from public.building_popular_times where building_slug is not null;",
  "delete from public.google_places where building_slug is not null;",
  "delete from public.opening_hours where source = 'google';",
  ...(googleRows.length
    ? [
        `insert into public.google_places (${GOOGLE_COLUMNS.join(", ")})`,
        "values",
        googleRows.map((r) => `  (${GOOGLE_COLUMNS.map((c) => googleValue(r, c)).join(", ")})`).join(",\n") + ";",
      ]
    : []),
  ...(googleHours.length
    ? [
        "insert into public.opening_hours (building_slug, space_id, label, valid_from, valid_until, weekday, opens, closes, access, source, source_url)",
        "select v.building_slug, null, v.label, v.valid_from::date, v.valid_until::date, v.weekday::smallint, v.opens::time, v.closes::time, v.access, v.source, v.source_url",
        `from (values\n${googleHours.map((r) => `  (${hoursValues(r)})`).join(",\n")}\n) as v (${HOURS_COLUMNS.join(", ")});`,
      ]
    : []),
  ...(popularTimes.length
    ? [
        `insert into public.building_popular_times (${POPULAR_COLUMNS.join(", ")})`,
        "values",
        popularTimes.map((r) => `  (${POPULAR_COLUMNS.map((c) => sql(r[c])).join(", ")})`).join(",\n") + ";",
      ]
    : []),
].join("\n");

// Class meetings change every term, so mguide's rows are replaced wholesale.
const CLASSROOM_COLUMNS = [
  "room_code", "building_code", "room_number", "building_slug", "course", "section",
  "title", "cross_listed", "weekdays", "starts", "ends", "first_day", "last_day",
];
const textArray = (list) =>
  `${sql(`{${list.map((t) => `"${t.replace(/["\\]/g, "\\$&")}"`).join(",")}}`)}::text[]`;
const classroomValue = (row, c) => {
  if (c === "cross_listed") return textArray(row.cross_listed);
  if (c === "weekdays") return `'{${row.weekdays.join(",")}}'::smallint[]`;
  return sql(row[c]);
};
const classroomSql = [
  "delete from public.classroom_meetings where source = 'mguide';",
  `insert into public.classroom_meetings (${CLASSROOM_COLUMNS.join(", ")})`,
  "values",
  classroomMeetings.map((r) => `  (${CLASSROOM_COLUMNS.map((c) => classroomValue(r, c)).join(", ")})`).join(",\n") + ";",
].join("\n");

const CHARACTERISTIC_COLUMNS = [
  "value", "category", "label", "page_label", "description", "glossary_anchor",
  "space_feature", "feature_match",
];
const CLASSROOM_ROOM_COLUMNS = [
  "mclassrooms_id", "room_code", "building_slug", "building_match", "building_official_id",
  "building_name", "building_code", "room_number", "floor_label", "address",
  "school_or_college", "seats", "characteristics", "features", "scheduling_contact",
  "support_contact", "notes", "notes_updated_on", "page_url", "schedule_url",
  "floor_map_url", "layout_pdf_url", "panorama_url", "photos", "fetched_on",
];
const classroomRoomValue = (row, c) => {
  if (c === "characteristics") return textArray(row.characteristics);
  if (c === "features") return features(row.features);
  if (["scheduling_contact", "support_contact", "photos"].includes(c)) return jsonb(row[c]);
  return sql(row[c]);
};
// MClassrooms rows are replaced wholesale on each export; nothing references
// them.
const mclassroomsSql = [
  "delete from public.classrooms where mclassrooms_id is not null;",
  "delete from public.classroom_characteristics where value is not null;",
  `insert into public.classroom_characteristics (${CHARACTERISTIC_COLUMNS.join(", ")})`,
  "values",
  characteristicRows
    .map((r) => `  (${CHARACTERISTIC_COLUMNS.map((c) => (c === "space_feature" && r[c] ? `${sql(r[c])}::public.space_feature` : sql(r[c]))).join(", ")})`)
    .join(",\n") + ";",
  `insert into public.classrooms (${CLASSROOM_ROOM_COLUMNS.join(", ")})`,
  "values",
  classrooms.map((r) => `  (${CLASSROOM_ROOM_COLUMNS.map((c) => classroomRoomValue(r, c)).join(", ")})`).join(",\n") + ";",
].join("\n");

const PRINTER_COLUMNS = [
  "mprint_name", "display_name", "building_record_number", "building_name",
  "building_slug", "floor_label", "floor", "room_number", "color", "tabloid",
  "copier", "poster", "staple", "card_reader", "price", "price_unit", "notes",
  "floor_map", "floor_map_x", "floor_map_y",
];
// Printers MPrint drops should disappear too, so its rows are replaced
// wholesale; manual rows are left alone. Nothing references a printer.
const printersSql = [
  "delete from public.printers where source = 'mprint';",
  `insert into public.printers (${PRINTER_COLUMNS.join(", ")})`,
  "values",
  printers.map((r) => `  (${PRINTER_COLUMNS.map((c) => sql(r[c])).join(", ")})`).join(",\n") + ";",
].join("\n");

const spaceId = (slug) => (slug ? `(select id from public.spaces where slug = ${sql(slug)})` : "null");
const bookableValues = (item) =>
  BOOKABLE_COLUMNS.map((c) => (c === "space_id" ? spaceId(item.space_slug) : sql(item[c]))).join(", ");

// Seeded rows are marked created_by 'seed' and replaced on every run. A space
// with any location an admin added in /admin/spaces gets no seeded rows.
const spaceLocationsSql = [
  "delete from public.space_locations where created_by = 'seed';",
  "insert into public.space_locations (space_id, floor, room_number, created_by)",
  "select s.id, v.floor, v.room_number, 'seed'",
  "from (values",
  spaceLocations
    .map((l) => `  (${sql(l.space_slug)}, ${sql(l.floor)}::smallint, ${sql(l.room_number)})`)
    .join(",\n"),
  ") as v (space_slug, floor, room_number)",
  "join public.spaces s on s.slug = v.space_slug",
  "where not exists (select 1 from public.space_locations l where l.space_id = s.id);",
].join("\n");

// With `keepEdited`, columns an admin changed in /admin/spaces (listed in the
// row's edited_fields) keep their value; everything else takes the snapshot's.
const upsert = (table, columns, rows, values, key, { keepEdited = false } = {}) =>
  [
    `insert into public.${table} (${columns.join(", ")})`,
    "values",
    rows.map((r) => `  (${values(r)})`).join(",\n"),
    `on conflict (${key}) do update set`,
    columns
      .filter((c) => !key.split(", ").includes(c))
      .map((c) =>
        keepEdited
          ? `  ${c} = case when '${c}' = any(${table}.edited_fields) then ${table}.${c} else excluded.${c} end`
          : `  ${c} = excluded.${c}`,
      )
      .join(",\n") + ";",
  ].join("\n");

const listedCount = spaces.filter((s) => s.is_listed).length;
const listedBookable = bookableItems.filter((item) => item.is_listed).length;
const header = `-- Generated by scripts/seed/build.mjs from scripts/seed/raw/ and scripts/serpapi/raw/ (see
-- raw/SOURCES.md for where and when each snapshot was fetched). Don't edit by
-- hand: change overrides.json or re-fetch, then rebuild.
--
-- ${buildings.length} buildings (${buildings.filter((b) => b.footprint).length} with footprints), ${spaces.length} spaces (${listedCount} listed),
-- ${bookableItems.length} LibCal bookable items (${listedBookable} listed, ${bookableItems.filter((item) => item.space_slug).length} linked to a space), ${spaceLocations.length} space locations,
-- ${openingHours.length} Library opening-hours rows,
-- ${entrances.length} building entrances (${linkedEntrances} linked to a building).
-- ${googleRows.length} Google places (scripts/serpapi/raw/places/), ${googleHours.length} Google opening-hours rows, ${popularTimes.length} popular-times rows.
-- ${classroomMeetings.length} class meetings in ${classroomRooms} classrooms (${linkedClassroomRooms} linked to a building, ${skippedMeetings} zero-length meetings skipped).
-- ${classrooms.length} MClassrooms classrooms (${linkedClassrooms} linked to a building), ${characteristicRows.length} room characteristics.
-- ${printers.length} MPrint printers (${linkedPrinters} linked to a building).
-- Idempotent: safe to run again against a database that already has the rows.
`;

// Each part starts with a "-- @section name" line so scripts/seed/section.mjs
// can load one part on its own (the "Load production data" workflow does).
const sections = [
  ["buildings", upsert("buildings", BUILDING_COLUMNS, buildings, buildingValues, "slug")],
  ["spaces", upsert("spaces", SPACE_COLUMNS, spaces, spaceValues, "slug", { keepEdited: true })],
  ["opening_hours", hoursSql],
  [
    "bookable_items",
    upsert("bookable_items", BOOKABLE_COLUMNS, bookableItems, bookableValues, "instance, libcal_item_id"),
  ],
  ["space_locations", spaceLocationsSql],
  ["building_entrances", entrancesSql],
  ["google", googleSql],
  ["classroom_meetings", classroomSql],
  ["mclassrooms", mclassroomsSql],
  ["printers", printersSql],
];

await writeFile(
  OUT,
  [
    header,
    "begin;",
    "",
    ...sections.flatMap(([name, body]) => [`-- @section ${name}`, body, ""]),
    "commit;",
    "",
  ].join("\n"),
);

console.log(
  `Wrote ${OUT}: ${buildings.length} buildings, ${spaces.length} spaces (${listedCount} listed), ` +
    `${bookableItems.length} bookable items (${listedBookable} listed), ${openingHours.length} opening-hours rows, ` +
    `${entrances.length} entrances (${linkedEntrances} linked), ${googleRows.length} Google places ` +
    `(${googleHours.length} hours rows, ${popularTimes.length} popular-times rows), ` +
    `${classroomMeetings.length} class meetings in ${classroomRooms} classrooms (${linkedClassroomRooms} linked), ` +
    `${classrooms.length} MClassrooms classrooms (${linkedClassrooms} linked), ` +
    `${printers.length} printers (${linkedPrinters} linked)`,
);
