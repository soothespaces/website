-- Short names. Lists read "Duderstadt  Floor 2 · Computing" instead of
-- "Art, Architecture, and Engineering Library Floor 2 Computing Spaces" over
-- "Duderstadt Center".
--
-- spaces.short_name is where the space is inside its building, without the
-- building or library name. The UI shows it next to the building's short
-- name and falls back to spaces.name when it's empty. The full name stays
-- for search and the admin pages. buildings.short_name already exists; this
-- sets what students call the buildings that have study spaces.
--
-- The same values live in scripts/seed/overrides.json, so seed.sql agrees.

alter table public.spaces add column short_name text;

comment on column public.spaces.short_name is
  'Where the space is inside its building, e.g. "Floor 2 · Computing". Shown next to the building''s short name; null falls back to name.';

update public.spaces s
set short_name = v.short_name
from (values
  ('taubman-health-sciences-library-study-space', 'Study space'),
  ('bentley-historical-library', 'Floor 1 · Reading room'),
  ('art-architecture-library', 'Floor 2 · Library'),
  ('music-library-carrels', 'Floor 4 · Music Library carrels'),
  ('music-library-floors-3-and-4', 'Floors 3–4 · Music Library'),
  ('east-quad-study-lounge', 'Floor 1 · Study lounge'),
  ('gerald-ford-library', 'Floor 1 · Reading room'),
  ('asia-library-reading-room', 'Asia Library reading room'),
  ('clark-library-seating-area', 'Clark Library seating'),
  ('hatcher-floor-6', 'Floor 6'),
  ('hatcher-north-212a', 'Floor 2 · North 212A'),
  ('hatcher-north-floor-2', 'Floor 2 · North'),
  ('hatcher-north-stacks-study-tables', 'North stacks · Study tables'),
  ('hatcher-reference-reading-room', 'Floor 2 · Reference reading room'),
  ('hatcher-south-bookable-daily-carrels', 'Floor 3 · South daily carrels'),
  ('hatcher-south-bookable-weekly-carrels', 'South · Weekly carrels'),
  ('hatcher-south-designated-ssd-carrels', 'South · SSD carrels'),
  ('hatcher-south-long-term-research-carrels', 'South · Research carrels'),
  ('hatcher-south-open-carrels', 'South · Open carrels'),
  ('international-studies-reading-room', 'Floor 1 · International Studies reading room'),
  ('berts-study-lounge', 'Floor 1 · Bert''s Study Lounge'),
  ('clark-commons-seating-areas', 'Floor 3 · Clark Commons'),
  ('clark-commons-computing-spaces', 'Floor 3 · Clark Commons computing'),
  ('shapiro-basement', 'Basement'),
  ('shapiro-bookable-study-rooms', 'Bookable study rooms'),
  ('shapiro-floor-1', 'Floor 1'),
  ('shapiro-floor-2', 'Floor 2'),
  ('shapiro-floor-4', 'Floor 4'),
  ('shapiro-reading-room', 'Floor 3 · Reading room'),
  ('soundproof-booths', 'Soundproof booths'),
  ('student-parent-and-caregiver-study-room', 'Parent and caregiver room'),
  ('art-architecture-and-engineering-library-floor-2-computing-spaces', 'Floor 2 · Computing'),
  ('art-architecture-and-engineering-library-floor-2-lobby-spaces', 'Floor 2 · Lobby'),
  ('art-architecture-and-engineering-library-floor-2-stacks-spaces', 'Floor 2 · Stacks'),
  ('art-architecture-and-engineering-library-floor-3', 'Floor 3'),
  ('duderstadt-center-interview-rooms', 'Floor 2 · Interview rooms'),
  ('michigan-union-study', 'Floor 2 · Study areas'),
  ('north-quad-study-lounge', 'Floor 1 · Study lounge'),
  ('palmer-commons-gallery', 'Floor 1 · Gallery'),
  ('dana-building-atrium', 'Floor 1 · Atrium'),
  ('south-quad-study-lounge', 'Floor 1 · Study lounge'),
  ('ross-winter-garden', 'Floor 1 · Winter Garden'),
  ('fine-arts-library-carrels', 'Fine Arts Library carrels'),
  ('fine-arts-library-floor-2', 'Floor 2 · Fine Arts Library'),
  ('weiser-hall-commons', 'Floor 1 · Commons'),
  ('pierpont-commons-study', 'Floor 2 · Study lounge'),
  ('law-library-reading-room', 'Main floor · Reading room')
) as v (slug, short_name)
where s.slug = v.slug
  and not ('short_name' = any(s.edited_fields));

update public.buildings b
set short_name = v.short_name
from (values
  ('harold-t-and-vivian-b-shapiro-library', 'Shapiro'),
  ('harlan-h-hatcher-graduate-library', 'Hatcher'),
  ('james-and-anne-duderstadt-center', 'Duderstadt'),
  ('alfred-a-taubman-health-sciences-library', 'Taubman Library'),
  ('alvin-m-arvella-d-bentley-historical-library', 'Bentley Library'),
  ('art-and-architecture-building', 'Art & Architecture'),
  ('earl-v-moore-building', 'Moore Building'),
  ('east-quadrangle', 'East Quad'),
  ('gerald-r-ford-library-1', 'Ford Library'),
  ('south-quadrangle', 'South Quad'),
  ('stephen-m-ross-school-of-business-building', 'Ross'),
  ('wilbur-k-pierpont-commons', 'Pierpont'),
  ('samuel-trask-dana-building', 'Dana Building')
) as v (slug, short_name)
where b.slug = v.slug;
