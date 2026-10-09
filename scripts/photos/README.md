# Photos

Imports building and study-space photos, flat or 360°, into the public `photos`
Storage bucket and `public.photos`. See
[Supabase Backend Plan § Photos](../../docs/technical/supabase-backend.md#photos) for
why photos are pre-resized instead of transformed on request.

| File | What |
|---|---|
| `photos.json` | Committed list of every photo, one entry each. The source of truth. |
| `originals/` | Your full-size files. Git-ignored: originals never go in the repo. |
| `import.mjs` | Resizes, strips metadata, uploads, upserts rows. |

## Entry format

```jsonc
{
  "file": "originals/shapiro-2-south.jpg",           // relative to scripts/photos/; or
  "source_url": "https://…",                         // a web image (also the credit link)
  "building_slug": "harold-t-and-vivian-b-shapiro-library", // or "space_slug": "…"
  "kind": "photo",                                   // or "panorama" (2:1 equirectangular)
  "floor": 2,                                        // optional
  "lat": 42.27561, "lng": -83.73715,                 // optional: where you stood
  "heading": 180,                                    // optional: compass direction faced
  "alt": "Long wooden tables by the south windows on Shapiro's second floor",
  "credit": "Tanner Aslan",
  "license": "Soothe Spaces team photo",
  "sort_order": 0,                                   // optional
  "is_listed": true                                  // optional
}
```

- **Position:** place `lat`/`lng` by clicking the spot on a map (with the floor plan
  overlaid once it's aligned), not from the phone's GPS, which drifts tens of meters
  indoors. Floor-plan pixels aren't used because MPrint crops each floor differently;
  map coordinates stay right when plans are re-exported or vectorized.
- **Panoramas:** export the stitched equirectangular JPEG (the Ricoh Theta Z1 from the
  U-M equipment loan catalog produces these directly). They're stored at widths 2048
  and 4096 for a 360° viewer; flat photos at 480, 960 and 1600. Nothing is upscaled.
- **People:** don't include recognizable people, or blur them before importing.
  `import.mjs` strips all metadata (EXIF GPS included) from what it uploads.
- **Alt text is required.** Describe what a student would want to know about the
  space, not just "photo of a room".

## Run it

```bash
node scripts/photos/import.mjs --dry-run   # validate and resize only
npm run photos:import                      # upload and upsert
npm run photos:import -- --prune           # also delete photos removed from photos.json
```

It needs `NEXT_PUBLIC_SUPABASE_URL` (from `npm run env:pull`) and
`SUPABASE_SECRET_KEY` (Supabase dashboard → Project Settings → API keys; it bypasses
RLS, so keep it in `.env.local` only). Files are named by a hash of the original, so
re-running is safe and a replaced image gets a fresh URL.
