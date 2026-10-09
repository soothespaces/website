// Snapshots the U-M Facilities & Operations campus map data (the ArcGIS
// Server behind map.fo.umich.edu):
//
//   scripts/campus-map/raw/accessibility.json
//       exterior doors (automatic, manual, non-accessible); scripts/seed/
//       build.mjs turns them into public.building_entrances
//   scripts/campus-map/raw/basemap-layers.json
//       every basemap layer's metadata (draw order, scale range, renderer
//       colors); style.mjs turns it into a MapLibre style
//   public/campus-map/<id>-<name>.geojson
//       the basemap's vector layers, trimmed to the fields their renderers
//       and labels use, served as static files for the map
//   public/campus-map/curb-ramps.geojson
//       curb ramps next to U-M property
//
// The server is a production university system: requests go one at a time
// with a pause between them.
//
//   node scripts/campus-map/fetch.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, "raw");
const PUBLIC = join(HERE, "..", "..", "public", "campus-map");
const SERVER = "https://gisapi.fo.umich.edu/arcgis/rest/services";
const ACCESSIBILITY = `${SERVER}/CampusAccessibility/MapServer`;
const BASEMAP = `${SERVER}/BaseMap/cMapBase_TC_NoLabels_WM/MapServer`;
const UA = "soothespaces-seed/1.0 (+https://github.com/soothespaces/website)";
const PAGE = 2000;

const pause = () => new Promise((resolve) => setTimeout(resolve, 400));

// ArcGIS reports errors as HTTP 200 with an "error" key, so check the body.
async function json(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(`${res.status} ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
      await pause();
      return body;
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
}

// Pages through a layer's query endpoint and checks the total against the
// server's own count.
async function features(layerUrl, meta, outFields) {
  const oid = meta.objectIdField ?? meta.fields.find((f) => f.type === "esriFieldTypeOID")?.name;
  const { count } = await json(`${layerUrl}/query?where=1%3D1&returnCountOnly=true&f=json`);
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: outFields.join(","),
      outSR: "4326",
      geometryPrecision: "6",
      orderByFields: oid,
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "geojson",
    });
    const page = await json(`${layerUrl}/query?${params}`);
    out.push(...page.features);
    if (page.features.length < PAGE) break;
  }
  if (out.length !== count) throw new Error(`${layerUrl}: got ${out.length} features, server count ${count}`);
  return out;
}

const collection = (features) => ({ type: "FeatureCollection", features });
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// A renderer keys on up to three fields, or on an Arcade valueExpression that
// reads $feature.<field>.
const fieldsUsedBy = (renderer) => [
  ...[renderer?.field1, renderer?.field2, renderer?.field3, renderer?.field].filter(Boolean),
  ...[...(renderer?.valueExpression ?? "").matchAll(/\$feature\.(\w+)/g)].map((m) => m[1]),
];
// Labels and building numbers are kept only where the map shows or joins them.
const LABEL_LAYERS = new Set(["Buildings", "Campus POI", "Water Features", "Athletic Field Areas"]);
const trimMeta = (meta) => ({
  id: meta.id,
  name: meta.name,
  type: meta.type,
  geometryType: meta.geometryType,
  objectIdField: meta.objectIdField,
  minScale: meta.minScale,
  maxScale: meta.maxScale,
  drawingInfo: meta.drawingInfo,
  fields: meta.fields?.map(({ name, type, alias, domain }) => ({ name, type, alias, domain })),
});

const fetchedAt = new Date().toISOString();
await mkdir(RAW, { recursive: true });
await mkdir(PUBLIC, { recursive: true });

// Accessibility: doors in layers 3-5, curb ramps in layer 2.
// Audit fields (editor names) and lock details (KeyCore) are left out.
const doorLayers = { 3: "automatic", 4: "manual", 5: "none" };
const DOOR_FIELDS = [
  "OBJECTID", "GlobalID", "Accessible", "InExt", "BldRecNbr", "Floor", "Automatic", "Keypad", "cCure",
  "Comments", "Material", "Type", "Swing", "ClearWidth", "ClearHeight", "AltText",
];
const accessibility = { fetchedAt, source: ACCESSIBILITY, layers: [], doors: [] };
for (const [id, access] of Object.entries(doorLayers)) {
  const meta = await json(`${ACCESSIBILITY}/${id}?f=json`);
  accessibility.layers.push({ ...trimMeta(meta), access });
  const names = new Set(meta.fields.map((f) => f.name));
  const doors = await features(`${ACCESSIBILITY}/${id}`, meta, DOOR_FIELDS.filter((name) => names.has(name)));
  for (const door of doors) accessibility.doors.push({ access, ...door });
  console.log(`doors layer ${id} (${meta.name}): ${doors.length}`);
}
await writeFile(join(RAW, "accessibility.json"), JSON.stringify(accessibility, null, 1) + "\n");

const rampMeta = await json(`${ACCESSIBILITY}/2?f=json`);
const ramps = await features(`${ACCESSIBILITY}/2`, rampMeta, [
  "OBJECTID", "Width", "Slope", "RampType", "DetectableWarning", "Condition", "GlobalID",
].filter((name) => rampMeta.fields.some((f) => f.name === name)));
await writeFile(join(PUBLIC, "curb-ramps.geojson"), JSON.stringify(collection(ramps)) + "\n");
console.log(`curb ramps (${rampMeta.geometryType}): ${ramps.length}`);

// Basemap: every feature layer, in the service's own order (ArcGIS draws the
// first-listed layer on top).
const service = await json(`${BASEMAP}?f=json`);
const layers = [];
for (const entry of service.layers) {
  const meta = await json(`${BASEMAP}/${entry.id}?f=json`);
  const info = trimMeta(meta);
  layers.push(info);
  if (meta.type !== "Feature Layer") continue;
  const names = new Set(meta.fields.map((f) => f.name));
  const wanted = [
    ...(LABEL_LAYERS.has(meta.name) ? ["Label", "ObjectName", "Name", "loc_ObjectNum"] : []),
    ...fieldsUsedBy(meta.drawingInfo?.renderer),
  ];
  const outFields = [...new Set(wanted.filter((name) => names.has(name)))];
  const file = `${entry.id}-${slugify(meta.name)}.geojson`;
  const list = await features(`${BASEMAP}/${entry.id}`, meta, outFields.length ? outFields : [meta.objectIdField]);
  await writeFile(join(PUBLIC, file), JSON.stringify(collection(list)) + "\n");
  info.file = file;
  console.log(`basemap ${file}: ${list.length} features, fields ${outFields.join(",")}`);
}
await writeFile(
  join(RAW, "basemap-layers.json"),
  JSON.stringify({ fetchedAt, source: BASEMAP, spatialReference: service.spatialReference, layers }, null, 1) + "\n",
);

await writeFile(
  join(RAW, "SOURCES.md"),
  [
    "# Campus map sources",
    "",
    `Fetched ${fetchedAt} by \`node scripts/campus-map/fetch.mjs\` from the U-M Facilities &`,
    "Operations ArcGIS Server behind https://map.fo.umich.edu/. Don't edit these files by hand;",
    "re-run the script to refresh them.",
    "",
    "| File | Source |",
    "|---|---|",
    `| \`accessibility.json\` | ${ACCESSIBILITY}/{3,4,5}: ${accessibility.doors.length} exterior doors |`,
    `| \`basemap-layers.json\` | ${BASEMAP}: metadata for ${layers.length} layers |`,
    `| \`public/campus-map/curb-ramps.geojson\` | ${ACCESSIBILITY}/2: ${ramps.length} curb ramps |`,
    `| \`public/campus-map/<id>-<name>.geojson\` | ${BASEMAP}: ${layers.filter((l) => l.file).length} vector layers |`,
    "",
  ].join("\n"),
);
