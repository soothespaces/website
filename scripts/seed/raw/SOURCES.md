# Seed sources

Fetched 2026-10-09T05:41:19.682Z by `node scripts/seed/fetch.mjs`. Don't edit these files by hand;
re-run the script to refresh them.

| File | URL | What |
|---|---|---|
| `mguide-study-spots.json` | https://mguide.app/data/study-spots.json | 24 hand-curated study spaces (mguide.app) |
| `mguide-buildings-meta.json` | https://mguide.app/data/buildings-meta.json | Building metadata (mguide.app, derived from U-M facilities data) |
| `mguide-buildings-map.geojson` | https://mguide.app/data/buildings-map.geojson | Building footprints (mguide.app) |
| `umich-buildings.json` | https://apibuilder.studentlife.umich.edu/api/1/type/building?limit=-1&visible[eq][]=1 | Official U-M building records (studentlife apibuilder) |
| `umich-library-fass.json` | https://www.lib.umich.edu/visit-and-study/study-spaces/find-study-space/ | U-M Library Find a Study Space: the page's fass-data and fass-icon-map script tags |
| `libcal-items.json` | https://{instance}/{spaces,seats}?lid={lid}&gid=0&c=-1 | LibCal bookable rooms and seats: the resources.push({...}) items on each location page, 466 items |
