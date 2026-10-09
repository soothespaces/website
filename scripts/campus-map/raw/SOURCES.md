# Campus map sources

Fetched 2026-10-09T06:57:18.783Z by `node scripts/campus-map/fetch.mjs` from the U-M Facilities &
Operations ArcGIS Server behind https://map.fo.umich.edu/. Don't edit these files by hand;
re-run the script to refresh them.

| File | Source |
|---|---|
| `accessibility.json` | https://gisapi.fo.umich.edu/arcgis/rest/services/CampusAccessibility/MapServer/{3,4,5}: 2653 exterior doors |
| `curb-ramps.geojson` | https://gisapi.fo.umich.edu/arcgis/rest/services/CampusAccessibility/MapServer/2: 940 curb ramps |
| `basemap/` | https://gisapi.fo.umich.edu/arcgis/rest/services/BaseMap/cMapBase_TC_NoLabels_WM/MapServer: 20 vector layers plus `layers.json` |
