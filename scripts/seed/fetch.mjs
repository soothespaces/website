// Pulls every seed source into scripts/seed/raw/ and records where and when
// each came from in raw/SOURCES.md. Raw files are committed snapshots and are
// never hand-edited; build.mjs turns them into supabase/seed.sql.
//
//   node scripts/seed/fetch.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = join(dirname(fileURLToPath(import.meta.url)), "raw");
const UA = "soothespaces-seed/1.0 (+https://github.com/soothespaces/website)";

// fetch with a few retries: the U-M sites occasionally reset a connection
// partway through a long crawl.
async function get(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, init);
      // Buffer the body inside the retry, since resets also happen mid-body.
      const body = await res.arrayBuffer();
      if (res.status < 500 || attempt === 3) {
        return new Response(body, { status: res.status, headers: res.headers });
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

const SOURCES = [
  {
    file: "mguide-study-spots.json",
    url: "https://mguide.app/data/study-spots.json",
    note: "24 hand-curated study spaces (mguide.app)",
  },
  {
    file: "mguide-buildings-meta.json",
    url: "https://mguide.app/data/buildings-meta.json",
    note: "Building metadata (mguide.app, derived from U-M facilities data)",
  },
  {
    file: "mguide-buildings-map.geojson",
    url: "https://mguide.app/data/buildings-map.geojson",
    note: "Building footprints (mguide.app)",
  },
  {
    file: "umich-buildings.json",
    url: "https://apibuilder.studentlife.umich.edu/api/1/type/building?limit=-1&visible[eq][]=1",
    note: "Official U-M building records (studentlife apibuilder)",
  },
  {
    file: "umich-library-fass.json",
    url: "https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/",
    note: "U-M Library Find a Study Space: the page's fass-data and fass-icon-map script tags",
    extract: (html) => ({
      spaces: scriptJson(html, "fass-data"),
      icons: scriptJson(html, "fass-icon-map"),
    }),
  },
];

// LibCal locations from docs/technical/data-sources.md § 10. Item metadata
// (title, capacity, booking URL) is embedded in each location's /spaces and
// /seats page as resources.push({...}) calls. Availability is never stored
// (ADR 0008), so the grid endpoint isn't fetched here.
const LIBCAL = {
  "umich.libcal.com": [2761, 3509, 23105, 14410, 14566, 4183, 4004, 5040],
  "umich-nc.libcal.com": [11261, 11258, 11265, 11359, 14919, 11414, 15851, 23054, 30547],
  "umich-cc.libcal.com": [21968, 46354],
};

function scriptJson(html, id) {
  const match = html.match(
    new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)</script>`),
  );
  if (!match) throw new Error(`script#${id} not found`);
  return JSON.parse(match[1]);
}

await mkdir(RAW, { recursive: true });
const fetchedAt = new Date().toISOString();
const rows = [];

for (const source of SOURCES) {
  const res = await get(source.url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${source.url}: HTTP ${res.status}`);
  const body = await res.text();
  const data = source.extract ? source.extract(body) : JSON.parse(body);
  const path = join(RAW, source.file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  rows.push(`| \`${source.file}\` | ${source.url} | ${source.note} |`);
  console.log(`${source.file}: ${body.length} bytes`);
}

const libcal = [];
for (const [instance, lids] of Object.entries(LIBCAL)) {
  for (const lid of lids) {
    for (const kind of ["spaces", "seats"]) {
      const url = `https://${instance}/${kind}?lid=${lid}&gid=0&c=-1`;
      const res = await get(url, { headers: { "user-agent": UA } });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const html = await res.text();
      const location = clean(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const items = libcalResources(html);
      console.log(`${url}: ${items.length} items (${location})`);
      if (items.length) libcal.push({ instance, lid, kind, url, location, items });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
await writeFile(join(RAW, "libcal-items.json"), JSON.stringify(libcal, null, 2) + "\n");
rows.push(
  `| \`libcal-items.json\` | https://{instance}/{spaces,seats}?lid={lid}&gid=0&c=-1 | LibCal bookable rooms and seats: the resources.push({...}) items on each location page, ${libcal.reduce((n, l) => n + l.items.length, 0)} items |`,
);

// The U-M Library's Drupal CMS behind lib.umich.edu exposes JSON:API. Buildings
// and locations carry hours (semester, exam and break periods, each with
// per-weekday open/close times); rooms carry capacity, size and booking links.
// Only the fields the seed uses are kept.
const CMS = "https://cms.lib.umich.edu/jsonapi";
const HOURS_KEYS = ["field_date_range", "field_hours_open"];
const pick = (object, keys) =>
  Object.fromEntries(keys.filter((key) => object?.[key] !== undefined).map((key) => [key, object[key]]));
const relId = (node, name) => {
  const data = node.relationships?.[name]?.data;
  if (Array.isArray(data)) return data.map((d) => d.id);
  return data?.id ?? null;
};

async function cmsAll(path) {
  const data = [];
  const included = [];
  let url = `${CMS}/${path}${path.includes("?") ? "&" : "?"}page[limit]=50`;
  while (url) {
    const res = await get(url, { headers: { "user-agent": UA, accept: "application/vnd.api+json" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const body = await res.json();
    data.push(...body.data);
    included.push(...(body.included ?? []));
    url = body.links?.next?.href ?? null;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return { data, included };
}

const hoursParagraphs = (included) =>
  included
    .filter((p) => p.type.startsWith("paragraph--"))
    .map((p) => ({ id: p.id, type: p.type, ...pick(p.attributes, HOURS_KEYS) }));

const cmsPlaces = async (type) => {
  const { data, included } = await cmsAll(`node/${type}?include=field_hours_open`);
  return {
    places: data.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.attributes.title,
      path: n.attributes.path?.alias ?? null,
      ...pick(n.attributes, ["field_hours_different_from_build", "field_display_hours_"]),
      parent_location: relId(n, "field_parent_location"),
      hours: relId(n, "field_hours_open"),
    })),
    hours: hoursParagraphs(included),
  };
};

const libraryCms = {
  buildings: await cmsPlaces("building"),
  locations: await cmsPlaces("location"),
  rooms: (await cmsAll("node/room")).data.map((n) => ({
    id: n.id,
    title: n.attributes.title,
    path: n.attributes.path?.alias ?? null,
    ...pick(n.attributes, [
      "field_room_number",
      "field_room_name",
      "field_capacity",
      "field_square_feet",
      "field_bookable",
      "field_booking_url",
      "field_noise_level",
      "field_space_features",
      "field_ada_accessible",
      "field_accessibility_notes",
      "field_um_location_id",
    ]),
    building: relId(n, "field_room_building"),
    floor: relId(n, "field_floor"),
  })),
  floors: (await cmsAll("taxonomy_term/floor")).data.map((t) => ({ id: t.id, name: t.attributes.name })),
};
await writeFile(join(RAW, "umich-library-cms.json"), JSON.stringify(libraryCms, null, 2) + "\n");
rows.push(
  `| \`umich-library-cms.json\` | ${CMS}/node/{building,location,room}, /taxonomy_term/floor | U-M Library CMS (JSON:API): ${libraryCms.buildings.places.length} buildings and ${libraryCms.locations.places.length} locations with hours periods, ${libraryCms.rooms.length} rooms, floor names |`,
);

// Each Find a Study Space entry has its own page with a longer description
// (where to find it, seating, what's nearby). Keep the page's <main> element,
// minus scripts, styles and SVG icons; build.mjs pulls the text out.
const libraryOrigin = "https://www.lib.umich.edu";
const fass = JSON.parse(await readFile(join(RAW, "umich-library-fass.json"), "utf8"));
const spacePages = [];
for (const space of fass.spaces) {
  const url = `${libraryOrigin}${space.slug.replace(/\/?$/, "/")}`;
  const res = await get(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? null;
  spacePages.push({
    slug: space.slug,
    url,
    main: main
      ?.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/g, "")
      .replace(/\s+/g, " "),
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
}
await writeFile(join(RAW, "umich-library-space-pages.json"), JSON.stringify(spacePages, null, 2) + "\n");
rows.push(
  `| \`umich-library-space-pages.json\` | ${libraryOrigin}/visit-and-study/study-spaces/…/ | The <main> HTML of each of the ${spacePages.length} Library study-space pages (full description) |`,
);

await writeFile(
  join(RAW, "SOURCES.md"),
  [
    "# Seed sources",
    "",
    `Fetched ${fetchedAt} by \`node scripts/seed/fetch.mjs\`. Don't edit these files by hand;`,
    "re-run the script to refresh them.",
    "",
    "| File | URL | What |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n"),
);

function clean(text) {
  return text ? text.replace(/\s+/g, " ").trim() : null;
}

// Pulls every resources.push({...}) object literal out of a LibCal page. The
// literals are plain data (strings, numbers, arrays), so they're parsed rather
// than evaluated; one that doesn't parse is kept as raw text to inspect.
function libcalResources(html) {
  const items = [];
  const marker = "resources.push(";
  for (let at = html.indexOf(marker); at !== -1; at = html.indexOf(marker, at + 1)) {
    const start = at + marker.length;
    try {
      const parser = literalParser(html, start);
      items.push(parser.value());
    } catch (error) {
      items.push({ unparsed: html.slice(start, html.indexOf(");", start)), error: error.message });
    }
  }
  return items;
}

function literalParser(text, start) {
  let i = start;
  const ws = () => {
    while (/\s/.test(text[i])) i++;
  };
  const fail = (what) => {
    throw new Error(`expected ${what} at ${i - start}: ${text.slice(i, i + 20)}`);
  };
  const string = () => {
    const quote = text[i++];
    let out = "";
    while (text[i] !== quote) {
      if (i >= text.length) fail("closing quote");
      if (text[i] === "\\") {
        const c = text[++i];
        if (c === "u") {
          out += String.fromCharCode(parseInt(text.slice(i + 1, i + 5), 16));
          i += 5;
          continue;
        }
        out += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[c] ?? c;
        i++;
        continue;
      }
      out += text[i++];
    }
    i++;
    return out;
  };
  const value = () => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const obj = {};
      for (;;) {
        ws();
        if (text[i] === "}") break;
        let key;
        if (text[i] === '"' || text[i] === "'") key = string();
        else {
          const m = text.slice(i).match(/^[A-Za-z_$][\w$]*/) ?? fail("key");
          key = m[0];
          i += key.length;
        }
        ws();
        if (text[i++] !== ":") fail("colon");
        obj[key] = value();
        ws();
        if (text[i] === ",") i++;
      }
      i++;
      return obj;
    }
    if (c === "[") {
      i++;
      const arr = [];
      for (;;) {
        ws();
        if (text[i] === "]") break;
        arr.push(value());
        ws();
        if (text[i] === ",") i++;
      }
      i++;
      return arr;
    }
    if (c === '"' || c === "'") return string();
    const m = text.slice(i).match(/^(-?\d+(?:\.\d+)?|true|false|null)/) ?? fail("value");
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  return { value };
}
