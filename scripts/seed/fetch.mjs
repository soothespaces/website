// Pulls every seed source into scripts/seed/raw/ and records where and when
// each came from in raw/SOURCES.md. Raw files are committed snapshots and are
// never hand-edited; build.mjs turns them into supabase/seed.sql.
//
//   node scripts/seed/fetch.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAW = join(dirname(fileURLToPath(import.meta.url)), "raw");
const UA = "soothespaces-seed/1.0 (+https://github.com/soothespaces/website)";

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
  const res = await fetch(source.url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${source.url}: HTTP ${res.status}`);
  const body = await res.text();
  const data = source.extract ? source.extract(body) : JSON.parse(body);
  const path = join(RAW, source.file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  rows.push(`| \`${source.file}\` | ${source.url} | ${source.note} |`);
  console.log(`${source.file}: ${body.length} bytes`);
}

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
