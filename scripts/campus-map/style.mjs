// Turns the campus basemap's ArcGIS renderers (raw/basemap-layers.json) into
// MapLibre sources and layers, written to public/campus-map/style.json. The
// result is a fragment to merge into the map's style, not a whole style: it
// has no basemap, glyphs or sprite of its own.
//
//   node scripts/campus-map/style.mjs
//
// Mapping:
// - Draw order: ArcGIS draws the first-listed layer on top, so the order is
//   reversed (MapLibre draws the last layer on top).
// - Scale range: a layer's minScale becomes minzoom (1:144,500 is zoom 12).
// - Polygons become a fill layer plus a line layer for the outline; lines
//   become line layers; tree points become small circles (the server's tree
//   icon isn't carried over).
// - uniqueValue renderers become "match" expressions on the renderer's
//   field(s). An Arcade valueExpression is supported for the two shapes the
//   basemap uses: a constant, and one field with everything else as "Other".
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "campus-map", "style.json");
const { layers: meta, fetchedAt, source } = JSON.parse(
  await readFile(join(HERE, "raw", "basemap-layers.json"), "utf8"),
);

// Web Mercator scale denominator at zoom 0 for 256 px tiles at 96 dpi.
const ZOOM0_SCALE = 591657527.591555;
const minzoom = (scale) => (scale ? Math.max(0, Math.round(Math.log2(ZOOM0_SCALE / scale) * 10) / 10) : 0);
const PT = 4 / 3;

const rgba = (color) =>
  color ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.round((color[3] / 255) * 1000) / 1000})` : null;
const visible = (color) => color && color[3] > 0;

// The classes of a uniqueValue renderer, flattened: each value (one per key
// field, joined by the delimiter) with its symbol.
function classes(renderer) {
  const out = [];
  for (const group of renderer.uniqueValueGroups ?? []) {
    for (const cls of group.classes) {
      for (const values of cls.values) out.push({ value: values.join(renderer.fieldDelimiter ?? ","), label: cls.label, symbol: cls.symbol });
    }
  }
  if (!out.length) {
    for (const info of renderer.uniqueValueInfos ?? []) out.push({ value: info.value, label: info.label, symbol: info.symbol });
  }
  return out;
}

// Returns { key, symbols: [{value, symbol}], fallback } where key is a
// MapLibre expression, or { constant: symbol }.
function keyed(renderer) {
  const list = classes(renderer);
  if (renderer.valueExpression) {
    const constant = renderer.valueExpression.match(/^\s*return\s+"([^"]*)";\s*$/);
    if (constant) return { constant: list.find((c) => c.value === constant[1])?.symbol ?? list[0].symbol };
    const fields = [...new Set([...renderer.valueExpression.matchAll(/\$feature\.(\w+)/g)].map((m) => m[1]))];
    if (fields.length !== 1) throw new Error(`Unsupported valueExpression: ${renderer.valueExpression}`);
    const other = list.find((c) => c.value === "Other");
    return {
      key: ["to-string", ["get", fields[0]]],
      symbols: list.filter((c) => c !== other),
      fallback: other?.symbol ?? renderer.defaultSymbol ?? null,
    };
  }
  const fields = [renderer.field1, renderer.field2, renderer.field3].filter(Boolean);
  const delimiter = renderer.fieldDelimiter ?? ",";
  const key =
    fields.length === 1
      ? ["to-string", ["get", fields[0]]]
      : ["concat", ...fields.flatMap((f, i) => (i ? [delimiter, ["to-string", ["get", f]]] : [["to-string", ["get", f]]]))];
  return { key, symbols: list, fallback: renderer.defaultSymbol ?? null };
}

// A paint property that varies by class, or a constant when it doesn't.
function paint(spec, pick, empty) {
  if (spec.constant) return pick(spec.constant) ?? empty;
  const pairs = spec.symbols.flatMap((c) => [c.value, pick(c.symbol) ?? empty]);
  const fallback = spec.fallback ? (pick(spec.fallback) ?? empty) : empty;
  const distinct = new Set([...pairs.filter((_, i) => i % 2), fallback].map(String));
  return distinct.size === 1 ? fallback : ["match", spec.key, ...pairs, fallback];
}

const TRANSPARENT = "rgba(0, 0, 0, 0)";
const sources = {};
const layers = [];

for (const layer of [...meta].reverse()) {
  if (!layer.file) continue;
  const renderer = layer.drawingInfo?.renderer;
  if (!renderer) continue;
  const id = `fo-${layer.id}`;
  sources[id] = {
    type: "geojson",
    data: `/campus-map/${layer.file}`,
    attribution: "U-M Facilities & Operations",
  };
  const spec = renderer.type === "simple" ? { constant: renderer.symbol } : keyed(renderer);
  const base = { source: id, minzoom: minzoom(layer.minScale), metadata: { "fo:layer": layer.name } };

  if (layer.geometryType === "esriGeometryPolygon") {
    const fill = paint(spec, (s) => (visible(s.color) ? rgba(s.color) : null), TRANSPARENT);
    if (fill !== TRANSPARENT) layers.push({ id: `${id}-fill`, type: "fill", ...base, paint: { "fill-color": fill } });
    const outline = paint(spec, (s) => (s.outline && visible(s.outline.color) ? rgba(s.outline.color) : null), TRANSPARENT);
    if (outline !== TRANSPARENT) {
      const dashed = spec.constant
        ? spec.constant.outline?.style === "esriSLSDash"
        : spec.symbols.some((c) => c.symbol.outline?.style === "esriSLSDash");
      const line = {
        id: `${id}-outline`,
        type: "line",
        ...base,
        paint: {
          "line-color": outline,
          "line-width": paint(spec, (s) => (s.outline ? Math.round(s.outline.width * PT * 100) / 100 : null), 0),
        },
      };
      // MapLibre can't vary a dash pattern per feature, so dashed classes get
      // their own layer.
      if (dashed && !spec.constant) {
        const dashedValues = spec.symbols.filter((c) => c.symbol.outline?.style === "esriSLSDash").map((c) => c.value);
        layers.push({ ...line, filter: ["!", ["in", spec.key, ["literal", dashedValues]]] });
        layers.push({
          ...line,
          id: `${id}-outline-dashed`,
          filter: ["in", spec.key, ["literal", dashedValues]],
          paint: { ...line.paint, "line-dasharray": [3, 2] },
        });
      } else {
        if (dashed) line.paint["line-dasharray"] = [3, 2];
        layers.push(line);
      }
    }
  } else if (layer.geometryType === "esriGeometryPolyline") {
    layers.push({
      id: `${id}-line`,
      type: "line",
      ...base,
      paint: {
        "line-color": paint(spec, (s) => rgba(s.color), TRANSPARENT),
        "line-width": paint(spec, (s) => Math.round(s.width * PT * 100) / 100, 1),
      },
    });
  } else if (layer.geometryType === "esriGeometryPoint") {
    layers.push({
      id: `${id}-circle`,
      type: "circle",
      ...base,
      paint: {
        "circle-color": "rgba(118, 160, 98, 0.85)",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 17, 1.5, 20, 6],
      },
    });
  }
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      _comment: `Generated by scripts/campus-map/style.mjs from ${source} (fetched ${fetchedAt}). Merge sources and layers into the map style; draw them above the basemap's land layers and below labels.`,
      sources,
      layers,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${OUT}: ${Object.keys(sources).length} sources, ${layers.length} layers`);
