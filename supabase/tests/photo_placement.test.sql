begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into public.buildings (slug, name)
values ('test-photo-building', 'Test Building');

select lives_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license,
                               kind, floor, lat, lng, heading)
    values ('test-photo-building', 'photos/test/pano', '{2048,4096}', 5376, 2688, 'A panorama',
            'Team', 'Team photo', 'panorama', 2, 42.2756, -83.7371, 180)$$,
  'a placed panorama with no source_url is allowed'
);

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license, kind)
    values ('test-photo-building', 'photos/test/a', '{480}', 480, 320, 'x', 'x', 'x', 'video')$$,
  '23514',
  null,
  'kind is photo or panorama'
);

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license, lat)
    values ('test-photo-building', 'photos/test/b', '{480}', 480, 320, 'x', 'x', 'x', 42.27)$$,
  '23514',
  null,
  'lat and lng are set together'
);

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license, heading)
    values ('test-photo-building', 'photos/test/c', '{480}', 480, 320, 'x', 'x', 'x', 90)$$,
  '23514',
  null,
  'heading needs a position'
);

select throws_ok(
  $$insert into public.photos (building_slug, path_prefix, widths, width, height, alt, credit, license,
                               lat, lng, heading)
    values ('test-photo-building', 'photos/test/d', '{480}', 480, 320, 'x', 'x', 'x', 42.27, -83.73, 360)$$,
  '23514',
  null,
  'heading is 0-359'
);

select * from finish();
rollback;
