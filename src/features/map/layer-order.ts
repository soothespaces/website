const COVERED = new Set(["background", "fill", "fill-extrusion", "line", "heatmap", "hillshade", "raster"]);

// The floor plan has to sit above the basemap's own footprints. Some styles
// draw those footprints after their first symbol layer, so "the first label"
// is not high enough and the building covers the plan.
export function floorPlanBeforeId(layers: { id: string; type: string }[]): string | undefined {
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (!layer) continue;
    if (layer.id.startsWith("slot-") || layer.id.startsWith("floor-plan") || layer.id.startsWith("building-selected")) {
      continue;
    }
    if (!COVERED.has(layer.type)) continue;
    return layers[index + 1]?.id;
  }
  return undefined;
}
