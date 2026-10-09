# Campus map data

Snapshots of the U-M Facilities & Operations campus map (the public ArcGIS Server
behind https://map.fo.umich.edu/). See
[Data Sources § 13](../../docs/technical/data-sources.md#13-u-m-facilities-campus-map-found-2026-10-09).

| File | What |
|---|---|
| `fetch.mjs` | Pages through the server one request at a time and writes the files below. |
| `style.mjs` | Turns `raw/basemap-layers.json` into `public/campus-map/style.json`. |
| `raw/accessibility.json` | 2,653 exterior doors. `scripts/seed/build.mjs` seeds them into `public.building_entrances`. |
| `raw/basemap-layers.json` | Every basemap layer's metadata: draw order, scale range, renderer colors. |
| `raw/SOURCES.md` | URLs and fetch time. |
| `public/campus-map/<id>-<name>.geojson` | The 20 basemap vector layers, WGS84, trimmed to the fields their renderers and labels use. |
| `public/campus-map/curb-ramps.geojson` | 940 curb ramps. |
| `public/campus-map/style.json` | MapLibre `sources` and `layers` for the basemap layers, in FO's draw order and colors. |

Don't edit the snapshots by hand.

## Refresh

Run the **Campus map snapshot** workflow from the Actions tab on a branch (cloud dev
sessions can't reach `gisapi.fo.umich.edu`; a local machine can run
`npm run campus-map:fetch`). It commits the refreshed files back to the branch. Then run
`npm run campus-map:style` and `npm run seed:build` and commit the results.

## Using the style

`style.json` is a fragment, not a whole style. Add its `sources` and `layers` to the
react-map-gl map's style, above the OSM/MapTiler land layers and below labels. Two
things to decide when wiring it up:

- `fo-20` (background) and `fo-10` (City of Ann Arbor road surface) are single polygons
  that cover the whole area. They reproduce FO's look but hide the OSM basemap
  underneath; drop them to overlay FO's campus detail on OSM instead.
- The GeoJSON is about 30 MB uncompressed (`19-um-campus-areas` alone is 12 MB).
  Vercel serves it gzipped, but MapLibre downloads a GeoJSON source as soon as it's
  added, whatever its layers' `minzoom`, so loading every layer up front is slow on
  phones. Either add the heavy sources only once the map is zoomed in, or convert the
  layers to one PMTiles file.
