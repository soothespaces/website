begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated;
set local search_path = public, extensions;

select plan(9);

insert into public.buildings (slug, name)
values ('test-hours-building', 'Test Building');

select lives_ok(
  $$insert into public.opening_hours (building_slug, valid_from, valid_until, weekday, opens, closes, source)
    values ('test-hours-building', '2026-08-30', '2027-05-08', 1, '00:00', '24:00', 'um_library'),
           ('test-hours-building', '2026-08-30', '2027-05-08', 6, '10:00', '02:00', 'um_library'),
           ('test-hours-building', '2026-11-26', '2026-11-26', 4, null, null, 'um_library')$$,
  'all-day, past-midnight and closed rows are allowed'
);

select throws_ok(
  $$insert into public.opening_hours (building_slug, valid_from, valid_until, weekday, opens, source)
    values ('test-hours-building', '2026-08-30', '2027-05-08', 1, '08:00', 'manual')$$,
  '23514', null, 'opens and closes are set together'
);

select throws_ok(
  $$insert into public.opening_hours (valid_from, valid_until, weekday, opens, closes, source)
    values ('2026-08-30', '2027-05-08', 1, '08:00', '17:00', 'manual')$$,
  '23514', null, 'hours need a building or a space'
);

select throws_ok(
  $$insert into public.opening_hours (building_slug, valid_from, valid_until, weekday, opens, closes, source)
    values ('test-hours-building', '2027-05-08', '2026-08-30', 1, '08:00', '17:00', 'manual')$$,
  '23514', null, 'valid_from is on or before valid_until'
);

insert into public.google_places (building_slug, place_id, name, extensions, fetched_at)
values ('test-hours-building', 'ChIJtest', 'Test Building',
        '{"accessibility": ["Wheelchair accessible entrance"]}', now());

insert into public.building_popular_times (building_slug, weekday, hour, busyness, fetched_at)
values ('test-hours-building', 2, 14, 99, now());

select throws_ok(
  $$insert into public.building_popular_times (building_slug, weekday, hour, busyness, fetched_at)
    values ('test-hours-building', 2, 15, 101, now())$$,
  '23514', null, 'busyness is 0-100'
);

set local role anon;

select is(
  (select count(*)::int from public.opening_hours where building_slug = 'test-hours-building'),
  3, 'anon can read opening hours'
);

select is(
  (select extensions -> 'accessibility' ->> 0 from public.google_places where building_slug = 'test-hours-building'),
  'Wheelchair accessible entrance', 'anon can read google places'
);

select is(
  (select busyness::int from public.building_popular_times where building_slug = 'test-hours-building'),
  99, 'anon can read popular times'
);

select throws_ok(
  $$insert into public.building_popular_times (building_slug, weekday, hour, busyness, fetched_at)
    values ('test-hours-building', 3, 9, 10, now())$$,
  '42501', null, 'anon cannot write popular times'
);

reset role;

select * from finish();
rollback;
