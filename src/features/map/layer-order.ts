const COVERED = new Set(["background", "fill", "fill-extrusion", "line", "heatmap", "hillshade", "raster"]);

// Our own layers read GeoJSON or image sources, and the slots are ours too.
// The basemap's layers read its vector or raster tiles.
const OWN_SOURCES = new Set(["geojson", "image", "video"]);

export type StackLayer = { id: string; type: string; sourceType?: string };

function isBasemap(layer: StackLayer) {
  return !layer.id.startsWith("slot-") && !OWN_SOURCES.has(layer.sourceType ?? "");
}

// Campus detail goes under the basemap's first label. Our own symbol layers
// (the noise glyphs sit in the floor-plan band) must not count, or the slot
// jumps above the floor plan and a theme change redraws FO's buildings over it.
export function campusDetailBeforeId(layers: StackLayer[]): string | undefined {
  return layers.find((layer) => isBasemap(layer) && layer.type === "symbol")?.id;
}

// The floor plan has to sit above the basemap's own footprints. Some styles
// draw those footprints after their first symbol layer, so "the first label"
// is not high enough and the building covers the plan. Only the basemap's
// layers count: our fills (the building hit area, study colors, curb ramps)
// would otherwise drag the slot above every label and the selection outline.
export function floorPlanBeforeId(layers: StackLayer[]): string | undefined {
  const basemap = layers.filter(isBasemap);
  for (let index = basemap.length - 1; index >= 0; index--) {
    const layer = basemap[index];
    if (!layer || !COVERED.has(layer.type)) continue;
    return basemap[index + 1]?.id;
  }
  return undefined;
}
