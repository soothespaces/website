# Campus map sources

Fetched 2026-10-09T07:05:55.959Z by `node scripts/campus-map/fetch.mjs` from the U-M Facilities &
Operations ArcGIS Server behind https://map.fo.umich.edu/. Don't edit these files by hand;
re-run the script to refresh them.

| File | Source |
|---|---|
| `accessibility.json` | https://gisapi.fo.umich.edu/arcgis/rest/services/CampusAccessibility/MapServer/{3,4,5}: 2653 exterior doors |
| `basemap-layers.json` | https://gisapi.fo.umich.edu/arcgis/rest/services/BaseMap/cMapBase_TC_NoLabels_WM/MapServer: metadata for 21 layers |
| `public/campus-map/curb-ramps.geojson` | https://gisapi.fo.umich.edu/arcgis/rest/services/CampusAccessibility/MapServer/2: 940 curb ramps |
| `public/campus-map/<id>-<name>.geojson` | https://gisapi.fo.umich.edu/arcgis/rest/services/BaseMap/cMapBase_TC_NoLabels_WM/MapServer: 20 vector layers |
