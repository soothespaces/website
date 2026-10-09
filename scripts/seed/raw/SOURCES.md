# Seed sources

Fetched 2026-10-09T06:11:22.095Z by `node scripts/seed/fetch.mjs`. Don't edit these files by hand;
re-run the script to refresh them.

| File | URL | What |
|---|---|---|
| `mguide-study-spots.json` | https://mguide.app/data/study-spots.json | 24 hand-curated study spaces (mguide.app) |
| `mguide-buildings-meta.json` | https://mguide.app/data/buildings-meta.json | Building metadata (mguide.app, derived from U-M facilities data) |
| `mguide-buildings-map.geojson` | https://mguide.app/data/buildings-map.geojson | Building footprints (mguide.app) |
| `umich-buildings.json` | https://apibuilder.studentlife.umich.edu/api/1/type/building?limit=-1&visible[eq][]=1 | Official U-M building records (studentlife apibuilder) |
| `umich-library-fass.json` | https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/ | U-M Library Find a Study Space: the page's fass-data and fass-icon-map script tags |
| `libcal-items.json` | https://{instance}/{spaces,seats}?lid={lid}&gid=0&c=-1 | LibCal bookable rooms and seats: the resources.push({...}) items on each location page, 466 items |
| `umich-library-cms.json` | https://cms.lib.umich.edu/jsonapi/node/{building,location,room}, /taxonomy_term/floor | U-M Library CMS (JSON:API): 11 buildings and 52 locations with hours periods, 137 rooms, floor names |
| `umich-library-space-pages.json` | https://www.lib.umich.edu/page-data/visit-and-study/study-spaces/…/page-data.json | The 34 Library study-space pages' own data (full description, links) |
